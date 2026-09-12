import QtQuick

Item {
    id: option

    required property string name
    required property int index
    property bool highlighted: false
    property real scaleFactor: 1
    property color accentColor: "#FF2A3C"
    property color textColor: "#E6E4D8"
    property color backgroundColor: "#0A0A08"
    property string fontFamily: ""

    signal highlightRequested(int index)
    signal selected(int index)

    objectName: "sessionOption" + index
    height: 34 * scaleFactor

    Rectangle {
        anchors.fill: parent
        color: option.highlighted || optionMouse.containsMouse ? option.accentColor : "transparent"
        opacity: option.highlighted || optionMouse.containsMouse ? 0.9 : 1
    }

    Text {
        anchors.left: parent.left
        anchors.leftMargin: 12 * option.scaleFactor
        anchors.verticalCenter: parent.verticalCenter
        text: ">"
        font.family: option.fontFamily
        font.pixelSize: 12 * option.scaleFactor
        color: option.highlighted || optionMouse.containsMouse ? option.backgroundColor : option.accentColor
    }

    Text {
        anchors.left: parent.left
        anchors.leftMargin: 34 * option.scaleFactor
        anchors.right: parent.right
        anchors.rightMargin: 12 * option.scaleFactor
        anchors.verticalCenter: parent.verticalCenter
        text: option.name.toUpperCase()
        elide: Text.ElideRight
        font.family: option.fontFamily
        font.pixelSize: 11 * option.scaleFactor
        font.letterSpacing: 0.8 * option.scaleFactor
        color: option.highlighted || optionMouse.containsMouse ? option.backgroundColor : option.textColor
    }

    MouseArea {
        id: optionMouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onEntered: option.highlightRequested(option.index)
        onClicked: option.selected(option.index)
    }
}
