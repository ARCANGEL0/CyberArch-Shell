import QtQuick
import QtQuick.Window
import QtMultimedia

Item {
    id: root
    readonly property real s: Screen.height / 768
    anchors.fill: parent

    property var imgExts: ["png", "jpg", "jpeg", "webp", "gif"]
    property int imgIdx: 0
    property bool imageMiss: false

    Image {
        anchors.fill: parent
        fillMode: Image.PreserveAspectCrop
        visible: status === Image.Ready
        source: Qt.resolvedUrl("current/image." + root.imgExts[root.imgIdx])
        onStatusChanged: {
            if (status !== Image.Error) return
            if (root.imgIdx < root.imgExts.length - 1) root.imgIdx++
            else root.imageMiss = true
        }
    }

    property var vidSrcs: ["current/video.mp4", "current/video.webm", "current/video.mkv"]
    property int vidIdx: 0

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectCrop
        visible: root.imageMiss
    }

    MediaPlayer {
        id: mediaplayer
        source: root.imageMiss
            ? (root.vidIdx < root.vidSrcs.length ? Qt.resolvedUrl(root.vidSrcs[root.vidIdx]) : Qt.resolvedUrl("bg.mp4"))
            : ""
        autoPlay: true
        loops: MediaPlayer.Infinite
        videoOutput: videoOutput
        onErrorChanged: {
            if (error === MediaPlayer.NoError) return
            if (root.vidIdx < root.vidSrcs.length - 1) root.vidIdx++
        }
    }
}
