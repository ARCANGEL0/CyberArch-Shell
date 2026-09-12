import QtQuick

Item {
    id: selector

    property var model
    property int rememberedIndex: -1
    property int currentIndex: 0
    property int highlightedIndex: currentIndex
    property bool expanded: false
    property bool selectionInitialized: false

    property real scaleFactor: 1
    property color accentColor: "#FF2A3C"
    property color accentSoftColor: "#FF6B78"
    property color textColor: "#E6E4D8"
    property color mutedColor: "#5A4A4E"
    property color labelColor: "#FFF200"
    property color backgroundColor: "#0A0A08"
    property color lineColor: Qt.rgba(154/255, 150/255, 138/255, 0.28)
    property string labelFontFamily: ""
    property string valueFontFamily: ""
    property Item previousFocusItem
    property Item nextFocusItem

    readonly property int sessionCount: sessionObjects.count
    readonly property bool interactive: sessionCount > 1
    readonly property string currentSessionName: {
        var count = sessionObjects.count
        var session = count > 0 ? sessionObjects.objectAt(currentIndex) : null
        return session ? session.sessionName : qsTr("نشستی یافت نشد")
    }

    height: 42 * scaleFactor
    activeFocusOnTab: interactive
    z: expanded ? 20 : 0

    Accessible.role: Accessible.ComboBox
    Accessible.name: qsTr("انتخاب نشست")
    Accessible.description: currentSessionName
    Accessible.focusable: interactive

    function normalizedIndex(index) {
        if (sessionCount === 0) return 0
        return index >= 0 && index < sessionCount ? index : 0
    }

    function syncSelection() {
        if (!selectionInitialized) {
            currentIndex = normalizedIndex(rememberedIndex)
        } else {
            currentIndex = normalizedIndex(currentIndex)
        }
        highlightedIndex = currentIndex
    }

    function openMenu() {
        if (!interactive) return
        highlightedIndex = currentIndex
        expanded = true
        sessionList.positionViewAtIndex(highlightedIndex, ListView.Contain)
    }

    function closeMenu() {
        expanded = false
        highlightedIndex = currentIndex
    }

    function toggleMenu() {
        if (expanded) closeMenu()
        else openMenu()
    }

    function activateHighlightedSession() {
        if (expanded) selectSession(highlightedIndex)
        else openMenu()
    }

    function moveHighlight(offset) {
        if (!expanded) openMenu()
        if (!expanded) return
        highlightedIndex = (highlightedIndex + offset + sessionCount) % sessionCount
        sessionList.positionViewAtIndex(highlightedIndex, ListView.Contain)
    }

    function selectSession(index) {
        if (sessionCount === 0) return
        currentIndex = normalizedIndex(index)
        closeMenu()
        forceActiveFocus()
    }

    onSessionCountChanged: syncSelection()
    onRememberedIndexChanged: {
        if (!selectionInitialized) syncSelection()
    }
    Component.onCompleted: {
        syncSelection()
        selectionInitialized = true
    }

    Keys.onReturnPressed: activateHighlightedSession()
    Keys.onEnterPressed: activateHighlightedSession()
    Keys.onEscapePressed: closeMenu()
    Keys.onUpPressed: moveHighlight(-1)
    Keys.onDownPressed: moveHighlight(1)
    Keys.onTabPressed: {
        closeMenu()
        if (nextFocusItem) nextFocusItem.forceActiveFocus()
    }
    Keys.onBacktabPressed: {
        closeMenu()
        if (previousFocusItem) previousFocusItem.forceActiveFocus()
    }
    Keys.onSpacePressed: activateHighlightedSession()

    Instantiator {
        id: sessionObjects
        model: selector.model
        delegate: QtObject {
            required property string name
            readonly property string sessionName: name
        }
    }

    CutPanel {
        anchors.fill: parent
        strokeColor: selector.activeFocus || selector.expanded ? selector.accentColor : selector.lineColor
        strokeWidth: 1 * selector.scaleFactor
        cut: 8 * selector.scaleFactor
        cutTopRight: true
        cutBottomLeft: true
        fillColor: selector.backgroundColor
        fillOpacity: selectorMouse.containsMouse || selector.expanded ? 0.72 : 0.4

        Behavior on strokeColor { ColorAnimation { duration: 180 } }
        Behavior on fillOpacity { NumberAnimation { duration: 160 } }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 2 * selector.scaleFactor
        color: selector.activeFocus || selector.expanded ? selector.accentColor : selector.lineColor
        Behavior on color { ColorAnimation { duration: 180 } }
    }

    Text {
        anchors.left: parent.left
        anchors.leftMargin: 14 * selector.scaleFactor
        anchors.verticalCenter: parent.verticalCenter
        text: qsTr("نشست")
        font.family: selector.labelFontFamily
        font.bold: true
        font.pixelSize: 9.5 * selector.scaleFactor
        font.letterSpacing: 1 * selector.scaleFactor
        color: selector.labelColor
    }

    Text {
        anchors.left: parent.left
        anchors.leftMargin: 78 * selector.scaleFactor
        anchors.right: sessionArrow.left
        anchors.rightMargin: 10 * selector.scaleFactor
        anchors.verticalCenter: parent.verticalCenter
        text: selector.currentSessionName.toUpperCase()
        elide: Text.ElideRight
        font.family: selector.valueFontFamily
        font.pixelSize: 11 * selector.scaleFactor
        font.letterSpacing: 0.8 * selector.scaleFactor
        color: selector.interactive ? selector.accentColor : selector.textColor
    }

    Text {
        id: sessionArrow
        anchors.right: parent.right
        anchors.rightMargin: 14 * selector.scaleFactor
        anchors.verticalCenter: parent.verticalCenter
        text: selector.interactive ? (selector.expanded ? "⌃" : "⌄") : ""
        font.family: selector.valueFontFamily
        font.pixelSize: 15 * selector.scaleFactor
        color: selector.activeFocus || selectorMouse.containsMouse ? selector.accentSoftColor : selector.mutedColor
    }

    MouseArea {
        id: selectorMouse
        anchors.fill: parent
        enabled: selector.interactive
        hoverEnabled: true
        cursorShape: selector.interactive ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: {
            selector.forceActiveFocus()
            selector.toggleMenu()
        }
    }

    Item {
        id: sessionMenu
        anchors.top: parent.bottom
        anchors.topMargin: 4 * selector.scaleFactor
        width: parent.width
        height: selector.expanded ? Math.min(selector.sessionCount, 4) * 34 * selector.scaleFactor + 4 * selector.scaleFactor : 0
        visible: height > 0
        clip: true

        CutPanel {
            anchors.fill: parent
            strokeColor: selector.accentColor
            strokeWidth: 1 * selector.scaleFactor
            cut: 8 * selector.scaleFactor
            cutTopLeft: true
            cutBottomRight: true
            fillColor: selector.backgroundColor
            fillOpacity: 0.96
        }

        ListView {
            id: sessionList
            anchors.fill: parent
            anchors.margins: 2 * selector.scaleFactor
            clip: true
            model: selector.model
            currentIndex: selector.highlightedIndex
            boundsBehavior: Flickable.StopAtBounds

            delegate: SessionOption {
                width: sessionList.width
                scaleFactor: selector.scaleFactor
                highlighted: index === selector.highlightedIndex
                accentColor: selector.accentColor
                textColor: selector.textColor
                backgroundColor: selector.backgroundColor
                fontFamily: selector.valueFontFamily
                onHighlightRequested: index => selector.highlightedIndex = index
                onSelected: index => selector.selectSession(index)
            }
        }
    }
}
