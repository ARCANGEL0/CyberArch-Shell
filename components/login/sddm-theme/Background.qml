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

    function nextImage() {
        if (imgIdx < imgExts.length) {
            bgImage.source = Qt.resolvedUrl("current/image." + imgExts[imgIdx])
            imgIdx++
        } else if (!imageMiss) {
            imageMiss = true
            nextVideo()
        }
    }

    Image {
        id: bgImage
        anchors.fill: parent
        fillMode: Image.PreserveAspectCrop
        visible: status === Image.Ready
        onStatusChanged: {
            if (status === Image.Error) root.nextImage()
        }
    }

    property var vidSrcs: ["current/video.mp4", "current/video.webm", "current/video.mkv", "current/video.mov", "bg.mp4"]
    property int vidIdx: 0
    property bool videoMiss: false

    function nextVideo() {
        if (vidIdx >= vidSrcs.length) {
            if (videoMiss) return
            videoMiss = true
            mediaplayer.stop()
            bgImage.source = Qt.resolvedUrl("fallback.jpg")
            return
        }
        mediaplayer.source = Qt.resolvedUrl(vidSrcs[vidIdx])
        vidIdx++
    }

    VideoOutput {
        id: videoOutput
        anchors.fill: parent
        fillMode: VideoOutput.PreserveAspectCrop
        visible: root.imageMiss && !root.videoMiss
    }

    MediaPlayer {
        id: mediaplayer
        autoPlay: true
        loops: MediaPlayer.Infinite
        videoOutput: videoOutput
        onErrorChanged: {
            if (error === MediaPlayer.NoError) return
            root.nextVideo()
        }
    }

    Component.onCompleted: nextImage()
}
