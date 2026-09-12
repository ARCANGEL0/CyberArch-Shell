import QtQuick
import QtTest

Item {
    id: testRoot
    width: 800
    height: 600

    ListModel {
        id: multipleSessions
        ListElement { name: "Hyprland" }
        ListElement { name: "Plasma (Wayland)" }
        ListElement { name: "Plasma (X11)" }
    }

    ListModel {
        id: singleSession
        ListElement { name: "Hyprland" }
    }

    TestCase {
        name: "SessionSelector"
        when: windowShown

        property var selector: null

        function createSelector(sessionModel, rememberedIndex) {
            var component = Qt.createComponent(
                Qt.resolvedUrl("../../components/login/sddm-theme/SessionSelector.qml")
            )
            compare(component.status, Component.Ready, component.errorString())

            selector = component.createObject(testRoot, {
                "width": 340,
                "model": sessionModel,
                "rememberedIndex": rememberedIndex
            })
            verify(selector !== null, component.errorString())
            tryCompare(selector, "sessionCount", sessionModel.count)
            return selector
        }

        function cleanup() {
            if (selector !== null) selector.destroy()
            selector = null
        }

        function test_rememberedSessionIsSelected() {
            var control = createSelector(multipleSessions, 1)

            compare(control.currentIndex, 1)
            compare(control.currentSessionName, "Plasma (Wayland)")
        }

        function test_invalidRememberedSessionFallsBackToFirst() {
            var control = createSelector(multipleSessions, 99)

            compare(control.currentIndex, 0)
            compare(control.currentSessionName, "Hyprland")
        }

        function test_singleSessionCannotOpenMenu() {
            var control = createSelector(singleSession, 0)

            compare(control.interactive, false)
            mouseClick(control, control.width / 2, control.height / 2)
            compare(control.expanded, false)
        }

        function test_mouseCanSelectSession() {
            var control = createSelector(multipleSessions, 0)

            mouseClick(control, control.width / 2, control.height / 2)
            compare(control.expanded, true)

            tryVerify(function() { return findChild(control, "sessionOption1") !== null })
            var option = findChild(control, "sessionOption1")
            verify(option !== null)
            mouseClick(option, option.width / 2, option.height / 2)

            compare(control.currentIndex, 1)
            compare(control.currentSessionName, "Plasma (Wayland)")
            compare(control.expanded, false)
        }

        function test_keyboardCanSelectSession() {
            var control = createSelector(multipleSessions, 0)

            control.forceActiveFocus()
            keyClick(Qt.Key_Return)
            compare(control.expanded, true)
            keyClick(Qt.Key_Down)
            keyClick(Qt.Key_Return)

            compare(control.currentIndex, 1)
            compare(control.currentSessionName, "Plasma (Wayland)")
            compare(control.expanded, false)
        }
    }
}
