import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { SpeechClient } from "@google-cloud/speech";

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require("fluent-ffmpeg");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);


initializeApp();
const storage = getStorage();
const bucket = storage.bucket("babytouch-63ad3.firebasestorage.app");

const speechClient = new SpeechClient();

export const speechToText = onCall({
  region: "us-central1",
  timeoutSeconds: 300,
  memory: "1GiB",
}, async (request) => {
  const { filePath } = request.data;
  if (!filePath) {
    logger.error("filePath がリクエストに含まれていません。");
    throw new Error("filePath が必要です。");
  }

  const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
  const convertedFilePath = path.join(os.tmpdir(), "converted.webm");

  try {
    // 1. GCSから一時ファイルにダウンロード
    logger.info(`GCSからファイルをダウンロード中: ${filePath}`);
    await bucket.file(filePath).download({ destination: tempFilePath });
    logger.info(`ダウンロード完了: ${tempFilePath}`);

    // 2. ffmpegでopusに変換
    logger.info("ffmpegによる音声変換を開始...");
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempFilePath)
        .format("webm")
        .audioCodec("libopus")
        .audioBitrate("48k")
        .on("error", (err: Error) => {
          logger.error("ffmpegエラー:", err);
          reject(err);
        })
        .on("end", () => {
          logger.info("ffmpegによる音声変換が完了。");
          resolve();
        })
        .save(convertedFilePath);
    });

    // 3. 変換したファイルを読み込み
    const audioBuffer = fs.readFileSync(convertedFilePath);
    const audioBytes = audioBuffer.toString("base64");
    logger.info("変換済みファイルの読み込みとBase64エンコードが完了。");

    // 4. Speech‐to‐Text で文字起こし
    logger.info("Speech‐to‐Text を開始...");
    const [operation] = await speechClient.longRunningRecognize({
      audio: { content: audioBytes },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "ja-JP",
        model: "latest_long",
        enableAutomaticPunctuation: true,
      },
    });
    const [response] = await operation.promise();
    let transcription = response.results
      ?.map((r) => r.alternatives?.[0].transcript)
      .join("\n") || "";

    if (!transcription) {
      logger.warn("文字起こし結果が空です。");
      transcription = "（音声が聞き取れませんでした）";
    }
    logger.info(`文字起こし完了: ${transcription}`);

    // 5. フロントエンドに返す
    return { text: transcription };
  } catch (err: any) {
    logger.error("エラーが発生しました:", err);
    throw new Error(`処理中にエラーが発生しました: ${err.message}`);
  } finally {
    // 一時ファイルを削除
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    if (fs.existsSync(convertedFilePath)) {
      fs.unlinkSync(convertedFilePath);
    }
  }
});

export const createVideo = onCall({
    region: "asia-northeast1",
    timeoutSeconds: 300,
    memory: "1GiB",
}, async (request) => {
    const { imagePath, audioPath } = request.data;

    if (!imagePath || !audioPath) {
        logger.error("imagePath and audioPath are required.");
        throw new Error("imagePath and audioPath are required.");
    }

    const tempDir = os.tmpdir();

    const tempImageFilePath = path.join(tempDir, path.basename(imagePath as string));
    const tempAudioFilePath = path.join(tempDir, path.basename(audioPath as string));
    const tempVideoFileName = `video_${Date.now()}.mp4`;
    const tempVideoFilePath = path.join(tempDir, tempVideoFileName);

    try {
        logger.info(`Downloading image from: ${imagePath}`);
        await bucket.file(imagePath as string).download({ destination: tempImageFilePath });
        logger.info(`Downloading audio from: ${audioPath}`);
        await bucket.file(audioPath as string).download({ destination: tempAudioFilePath });
        logger.info("Download complete.");

        logger.info("Starting video creation with ffmpeg...");
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(tempImageFilePath)
                .loop()
                .input(tempAudioFilePath)
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions(["-pix_fmt yuv420p", "-shortest"])
                .on("end", () => {
                    logger.info("ffmpeg processing finished.");
                    resolve();
                })
                .on("error", (err: Error) => {
                    logger.error("ffmpeg error:", err);
                    reject(err);
                })
                .save(tempVideoFilePath);
        });
        logger.info("Video creation complete.");

        const destination = `videos/${tempVideoFileName}`;
        logger.info(`Uploading video to: ${destination}`);
        await bucket.upload(tempVideoFilePath, {
            destination: destination,
            metadata: {
                contentType: "video/mp4",
            },
        });
        logger.info("Video upload complete.");

        const file = bucket.file(destination);
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const [url] = await file.getSignedUrl({
            action: "read",
            expires: expires,
        });
        logger.info("Signed URL generated.");

        return { videoUrl: url };
    } catch (err: any) {
        logger.error("Error creating video:", err);
        throw new Error(`Error creating video: ${err.message}`);
    } finally {
        logger.info("Cleaning up temporary files.");
        if (fs.existsSync(tempImageFilePath)) {
            fs.unlinkSync(tempImageFilePath);
        }
        if (fs.existsSync(tempAudioFilePath)) {
            fs.unlinkSync(tempAudioFilePath);
        }
        if (fs.existsSync(tempVideoFilePath)) {
            fs.unlinkSync(tempVideoFilePath);
        }
        logger.info("Cleanup complete.");
    }
});
