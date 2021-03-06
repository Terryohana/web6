/* import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose"; */

// https://github.com/burnpiro/erdem.pl/blob/master/src/components/Detector/Detector.js
import * as handposeWorker from '../handpose.worker.js';
// const handposeWorker = () => require('../handposeWorker');
import { Camera } from "@mediapipe/camera_utils/camera_utils";
import * as fp from "fingerpose";

/* 
    GLOBAL AFRAME, THREE
*/

AFRAME.registerComponent('custom-controls', {
    schema: {
        video: { type: 'selector', default: 'video' }
    },
    init: async function () {
        const el = this.el;

        // await tf.setBackend("wasm");
        /* await tf.ready();
        this.model = await handpose.load(); */

        this.worker = handposeWorker();
        // console.log(this.worker);

        // add "✌" and "👍" as sample gestures
        this.gesture = new fp.GestureEstimator([
            fp.Gestures.VictoryGesture,
            fp.Gestures.ThumbsUpGesture
        ]);

    },

    predict: async function (model, video) {
        const self = this;
        const elem = this.el;
        const object3d = this.el.object3D;

        // console.log(video);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const pixels = context.getImageData(0, 0, video.videoWidth, video.videoHeight);
        // console.log(canvas.toDataURL());
        // console.log(pixels);
        // const predictions = await model.estimateHands(pixels, true);
        const predictions = await this.worker.predict(pixels);
        console.log(predictions)

        if (predictions.length > 0) {


            predictions.forEach(({ annotations: hand }) => {
                let scaled_hand = {};

                // scale hand joint to fit camera video
                for (let finger in hand) {
                    scaled_hand[finger] = hand[finger].map(joint => {
                        const vec3 = new THREE.Vector3().fromArray(joint);
                        const scaled_vec3 = self.scalePosition(vec3);
                        return scaled_vec3;
                    });
                }

                // show joints as connected lines in 3d scene
                for (let finger in scaled_hand) {
                    for (let i = 0; i < scaled_hand[finger].length - 1; i++) {
                        const elem = document.getElementById(finger);
                        elem.setAttribute(`line__${i}`, {
                            start: scaled_hand[finger][i],
                            end: scaled_hand[finger][i + 1],
                        })
                    }
                }
                object3d.position.copy(scaled_hand.palmBase[0]);

                // using a minimum confidence of 7.5 (out of 10)
                const estimatedGestures = this.gesture.estimate(predictions[0].landmarks, 7.5);
                console.log(estimatedGestures);

                // emit event when gesture is found
                if (estimatedGestures.gestures.some(pose => pose.name == "thumbs_up")) {
                    elem.emit("triggerdown");
                    console.log("grip");

                } else {
                    elem.emit("triggerup");
                    console.log("ungrip");
                };
            });
        }
    },

    // scale hand joint to fit camera video
    scalePosition: function (vec3) {

        const width = this.data.video.videoWidth;
        const height = this.data.video.videoHeight;

        const aspect = height / width;
        const scale = 2 * Math.sqrt(width / 1000);
        // const correction = new THREE.Vector2(-0.15, 0.27);
        const correction = new THREE.Vector2(0.45, 0.5);

        return new THREE.Vector3(
            scale * (-vec3.x / width + correction.x),
            scale * (-vec3.y / height + correction.y) * aspect,
            scale * (- vec3.z / 500)
        );
    },

    update: function () {
        const data = this.data;
        const el = this.el;
        const self = this;

        // wait for camera permission and predict on every frame
        const camera = new Camera(data.video, {
            onFrame: async () => {
                await self.predict(self.model, data.video);
            }/* ,
            width: data.video.videoWidth,
            height: data.video.videoHeight */
        });
        camera.start();

    }
});