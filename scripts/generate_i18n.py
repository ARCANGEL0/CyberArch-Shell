#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
SOURCE_FILE = ROOT / "components/modules/i18n.ts"
OUTPUT_FILE = ROOT / "components/modules/i18n.generated.ts"
API_URL = "https://translation.googleapis.com/language/translate/v2"
PUBLIC_API_URL = "https://clients5.google.com/translate_a/t"
API_CODES = {"cz": "cs", "zh": "zh-CN"}
CHECKPOINT_FILE = Path(tempfile.gettempdir()) / "cyberpunk-hyprland-i18n-progress.json"
LANG_ORDER = [
    "en", "ru", "fr", "es", "pt", "de", "sv", "nl", "no", "da", "fi", "hu", "ro", "bg", "el", "uk", "be", "sk", "sl", "hr", "sr", "lt", "lv", "et", "ja", "zh", "ko", "th", "vi", "id", "ms", "ar", "he", "fa", "ur", "it", "tr", "pl", "cz",
]
PLACEHOLDER_RE = re.compile(r"<[^<>]+>|~/[A-Za-z0-9_./-]+|YYYY-MM-DD|HH:MM:SS|timedatectl")
ENTRY_RE = re.compile(r'^\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*("(?:\\.|[^"\\])*")\s*,?\s*$')
MAX_BATCH_ITEMS = 256
MAX_BATCH_CHARS = 3500


def read_catalog() -> dict[str, str]:
    source = SOURCE_FILE.read_text(encoding="utf-8")
    start = source.index("export const EN: Record<string, string> = {")
    end = source.index("\n}\n\nconst langs", start)
    catalog: dict[str, str] = {}
    for line in source[start:end].splitlines():
        match = ENTRY_RE.match(line)
        if not match:
            continue
        key = json.loads('"' + match.group(1) + '"')
        value = json.loads(match.group(2))
        if key in catalog:
            raise ValueError(f"Duplicate English catalog key: {key}")
        catalog[key] = value
    if not catalog:
        raise ValueError("English catalog is empty or could not be parsed")
    return catalog


def batch_items(items: list[tuple[str, str]]) -> list[list[tuple[str, str]]]:
    batches: list[list[tuple[str, str]]] = []
    current: list[tuple[str, str]] = []
    size = 0
    for item in items:
        item_size = len(item[1])
        if current and (len(current) >= MAX_BATCH_ITEMS or size + item_size > MAX_BATCH_CHARS):
            batches.append(current)
            current, size = [], 0
        current.append(item)
        size += item_size
    if current:
        batches.append(current)
    return batches


def protect_placeholders(text: str, placeholder_base: int = 9000) -> tuple[str, list[tuple[str, str]]]:
    protected: list[tuple[str, str]] = []

    def replace(match: re.Match[str]) -> str:
        token = f"⟦{placeholder_base + len(protected)}⟧"
        protected.append((token, match.group(0)))
        return token

    return PLACEHOLDER_RE.sub(replace, text), protected


def restore_placeholders(text: str, protected: list[tuple[str, str]], key: str) -> str:
    for token, original in protected:
        if token not in text:
            raise ValueError(f"Translation dropped a protected token in {key}")
        text = text.replace(token, original)
    return text


def translate_batch(api_key: str, target: str, texts: list[str]) -> list[str]:
    if not api_key:
        query = "\n".join(texts)
        command = [
            "rtk", "proxy", "curl", "-fsS", "--connect-timeout", "3",
            "--max-time", "45", "--retry", "4", "--retry-all-errors",
            "--retry-delay", "2", "--get", PUBLIC_API_URL,
            "--data-urlencode", "client=dict-chrome-ex",
            "--data-urlencode", "sl=en",
            "--data-urlencode", f"tl={target}",
            "--data-urlencode", "q=" + query,
        ]
        try:
            response = subprocess.run(command, check=True, capture_output=True, text=True, timeout=70)
            payload = json.loads(response.stdout)
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Public translation request failed for {target}") from error
        if not isinstance(payload, list) or len(payload) != 1 or not isinstance(payload[0], str):
            raise ValueError(f"Public translation endpoint returned an unexpected response for {target}")
        translations = payload[0].splitlines()
        if len(translations) != len(texts):
            if len(texts) == 1:
                translations = [payload[0]]
            else:
                midpoint = len(texts) // 2
                return translate_batch("", target, texts[:midpoint]) + translate_batch("", target, texts[midpoint:])
        localized_digits = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
        translations = [re.sub(r"⟦([0-9٠-٩۰-۹]+)⟧", lambda match: f"⟦{match.group(1).translate(localized_digits)}⟧", value) for value in translations]
        return [html.unescape(value) for value in translations]

    payload = json.dumps({"q": texts, "source": "en", "target": target, "format": "text"}).encode("utf-8")
    request = Request(
        API_URL + "?" + urlencode({"key": api_key}),
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=45) as response:
                result = json.loads(response.read().decode("utf-8"))
            translations = result.get("data", {}).get("translations", [])
            if len(translations) != len(texts):
                raise ValueError("Translation provider returned an incomplete batch")
            return [html.unescape(item["translatedText"]) for item in translations]
        except HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"Google Translation API returned HTTP {error.code}") from None
        except URLError:
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError("Could not reach Google Translation API") from None
    raise RuntimeError("Translation request failed after retries")


def render_module(catalogs: dict[str, dict[str, str]], source_hash: str, english: dict[str, str]) -> str:
    source_values = json.dumps(english, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    payload = json.dumps(catalogs, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return (
        f'export const GENERATED_SOURCE_HASH = "{source_hash}"\n'
        "export const GENERATED_SOURCE_VALUES: Record<string, string> = "
        + source_values
        + "\n"
        "export const GENERATED_TRANSLATIONS: Record<string, Record<string, string>> = "
        + payload
        + "\n"
    )


def load_checkpoint(source_hash: str, targets: list[str], english: dict[str, str]) -> dict[str, dict[str, str]]:
    try:
        checkpoint = json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if checkpoint.get("source_hash") != source_hash or checkpoint.get("targets") != targets:
        return {}
    catalogs = checkpoint.get("catalogs", {})
    return {
        language: catalog
        for language, catalog in catalogs.items()
        if language in targets and isinstance(catalog, dict) and set(catalog) == set(english)
    }


def load_existing_catalogs(source_hash: str, targets: list[str], english: dict[str, str]) -> dict[str, dict[str, str]]:
    try:
        source = OUTPUT_FILE.read_text(encoding="utf-8")
        payload_marker = "export const GENERATED_TRANSLATIONS: Record<string, Record<string, string>> = "
        catalogs = json.loads(source.split(payload_marker, 1)[1])
        values_marker = "export const GENERATED_SOURCE_VALUES: Record<string, string> = "
        source_values = json.loads(source.split(values_marker, 1)[1].split("\n", 1)[0]) if values_marker in source else None
    except (OSError, IndexError, json.JSONDecodeError):
        return {}
    match = re.search(r'export const GENERATED_SOURCE_HASH = "([0-9a-f]+)"', source)
    if match:
        if set(catalogs) != set(targets) or any(not isinstance(catalogs.get(language), dict) for language in targets):
            return {}
        if match.group(1) == source_hash:
            return {language: catalogs[language] for language in targets if set(catalogs[language]) == set(english)}
        if isinstance(source_values, dict):
            reusable = {key for key, value in english.items() if source_values.get(key) == value}
            return {
                language: {key: value for key, value in catalogs[language].items() if key in reusable}
                for language in targets
            }
        return {}
    missing_by_language = {
        language: set(english) - set(catalogs.get(language, {}))
        for language in targets
        if isinstance(catalogs.get(language), dict)
    }
    if set(missing_by_language) != set(targets) or not missing_by_language:
        return {}
    missing = next(iter(missing_by_language.values()))
    if len(missing) > 3 or any(keys != missing for keys in missing_by_language.values()):
        return {}
    if any(not set(catalogs[language]).issubset(english) for language in targets):
        return {}
    return {language: catalogs[language] for language in targets}


def save_checkpoint(source_hash: str, targets: list[str], catalogs: dict[str, dict[str, str]]) -> None:
    CHECKPOINT_FILE.write_text(
        json.dumps({"source_hash": source_hash, "targets": targets, "catalogs": catalogs}, ensure_ascii=False),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Translate and write every missing locale catalog")
    args = parser.parse_args()

    try:
        english = read_catalog()
        targets = [code for code in LANG_ORDER if code not in ("en", "pt")]
        char_count = sum(len(value) for value in english.values())
        print(f"English strings: {len(english)}")
        print(f"Target catalogs: {len(targets)}")
        print(f"Source characters per catalog: {char_count}")
        if not args.write:
            print("Dry run only. --write generates static catalogs; set GOOGLE_TRANSLATE_API_KEY to use the billed Cloud API.")
            return 0

        api_key = os.environ.get("GOOGLE_TRANSLATE_API_KEY", "").strip()
        source_hash = hashlib.sha256(json.dumps(english, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        generated = load_checkpoint(source_hash, targets, english)
        if not generated:
            generated = load_existing_catalogs(source_hash, targets, english)
        for language in targets:
            if language in generated and set(generated[language]) == set(english):
                print(f"Using saved catalog for {language}", flush=True)
                continue
            api_target = API_CODES.get(language, language)
            local_catalog = dict(generated.get(language, {}))
            items = [(key, value) for key, value in english.items() if key not in local_catalog]
            batches = batch_items(items)
            print(f"Translating {language} ({api_target})", flush=True)
            for batch in batches:
                prepared: list[str] = []
                protected_by_key: dict[str, list[tuple[str, str]]] = {}
                for row_index, (key, value) in enumerate(batch):
                    prepared_value, protected = protect_placeholders(value, 9000 + row_index * 100)
                    prepared.append(prepared_value)
                    protected_by_key[key] = protected
                translated = translate_batch(api_key, api_target, prepared)
                for (key, _), value in zip(batch, translated):
                    local_catalog[key] = restore_placeholders(value, protected_by_key[key], key)
            if set(local_catalog) != set(english):
                raise ValueError(f"Catalog coverage check failed for {language}")
            generated[language] = local_catalog
            save_checkpoint(source_hash, targets, generated)

        if set(generated) != set(targets):
            raise ValueError("Not all target locale catalogs were generated")
        output = render_module(generated, source_hash, english)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=OUTPUT_FILE.parent, prefix=".i18n-generated-", delete=False) as temporary:
            temporary.write(output)
            temp_name = temporary.name
        Path(temp_name).replace(OUTPUT_FILE)
        CHECKPOINT_FILE.unlink(missing_ok=True)
        print(f"Wrote {len(generated)} complete locale catalogs to {OUTPUT_FILE.relative_to(ROOT)}")
        return 0
    except (OSError, ValueError, RuntimeError) as error:
        print(f"i18n generation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
