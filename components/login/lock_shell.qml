import QtQuick
import Quickshell
import Quickshell.Wayland
import Quickshell.Services.Pam
import QtMultimedia

ShellRoot {
    id: shellRoot

    property string activeTheme: Quickshell.env("QS_THEME") || "netwatch"
    property string themePath: Quickshell.env("QS_THEME_PATH") || (Quickshell.shellDir + "/themes/" + activeTheme)

    readonly property string currentUser: Quickshell.env("USER") || "V"
    readonly property bool isWayland: Quickshell.env("XDG_SESSION_TYPE") === "wayland"
    property bool authenticated: false
    property bool sessionLocked: true
    property bool isTesting: Quickshell.env("QS_TESTING") === "1"

    signal loginOK()
    signal loginFail()

    function doAuth(user, pass) {
        pam.user = user || currentUser
        pam.pendingPassword = pass
        pam.start()
    }

    PamContext {
        config: Quickshell.env("QS_PAM_CONFIG") || "login"
        id: pam
        property string pendingPassword: ""

        onResponseRequiredChanged: {
            if (responseRequired && pendingPassword !== "") {
                respond(pendingPassword)
                pendingPassword = ""
            }
        }

        onCompleted: (result) => {
            if (result === PamResult.Success) {
                shellRoot.authenticated = true
                shellRoot.loginOK()
                Quickshell.execDetached(["loginctl", "unlock-session"])

                let delay = 100
                if (activeTheme.includes("clockwork")) delay = 500
                quitTimer.interval = delay
                quitTimer.start()
            } else {
                shellRoot.loginFail()
            }
        }
    }

    Timer {
        id: quitTimer
        interval: 3000
        onTriggered: {
            shellRoot.sessionLocked = false
            Qt.quit()
        }
    }

    Component {
        id: themeComponent
        Loader {
            anchors.fill: parent
            source: "file://" + shellRoot.themePath + "/Main.qml"

            onLoaded: {
                item.forceActiveFocus()
            }
            onStatusChanged: {
                if (status === Loader.Error) {
                    console.error("FAILED to load theme:", source)
                }
            }
        }
    }

    Loader {
        id: waylandLoader
        active: shellRoot.isWayland
        sourceComponent: Component {
            WlSessionLock {
                id: lock
                locked: shellRoot.sessionLocked
                surface: Component {
                    WlSessionLockSurface {
                        color: "black"

                        PinchHandler { target: null }
                        WheelHandler { target: null }

                        MouseArea {
                            anchors.fill: parent
                            acceptedButtons: Qt.AllButtons
                            hoverEnabled: true
                            onWheel: (wheel) => { wheel.accepted = true }
                        }

                        Loader {
                            anchors.fill: parent
                            sourceComponent: themeComponent
                        }
                    }
                }
            }
        }
    }

    Loader {
        id: x11Loader
        active: !shellRoot.isWayland
        sourceComponent: Component {
            Variants {
                model: Quickshell.screens
                delegate: Window {
                    id: window
                    required property var modelData
                    screen: modelData
                    width: isTesting ? 1280 : screen.width
                    height: isTesting ? 720 : screen.height
                    visible: shellRoot.sessionLocked
                    visibility: isTesting ? Window.Windowed : Window.FullScreen

                    onClosing: (close) => {
                        close.accepted = shellRoot.authenticated || shellRoot.isTesting;
                    }

                    flags: Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint | Qt.MaximizeUsingFullscreenGeometryHint
                    color: "black"

                    Loader {
                        anchors.fill: parent
                        sourceComponent: themeComponent
                    }
                }
            }
        }
    }
}
