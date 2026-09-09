import QtQuick
import QtQuick.Window
import QtMultimedia
import Quickshell

Item {
    id: root
    readonly property real s: Screen.height / 768
    anchors.fill: parent

    readonly property string wp: (Quickshell.env("QS_WALLPAPER") || "").trim()
    readonly property bool isVideo: /\.(mp4|webm|mkv|mov)$/i.test(wp)
    property bool videoActive: !wp || isVideo
    property string videoSource: isVideo ? ("file://" + wp) : Qt.resolvedUrl("bg.mp4")

    Image {
        anchors.fill: parent
        fillMode: Image.PreserveAspectCrop
        visible: status === Image.Ready
        source: (wp && !isVideo) ? ("file://" + wp) : ""
        onStatusChanged: if (status === Image.Error) root.videoActive = true
    }

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectCrop
        visible: root.videoActive
    }

    MediaPlayer {
        id: mediaplayer
        source: root.videoActive ? root.videoSource : ""
        autoPlay: true
        loops: MediaPlayer.Infinite
        videoOutput: videoOutput
        onErrorChanged: if (error !== MediaPlayer.NoError) root.videoSource = Qt.resolvedUrl("bg.mp4")
    }
}
