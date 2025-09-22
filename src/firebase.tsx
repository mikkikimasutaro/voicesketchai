import { initializeApp } from 'firebase/app';
import { getAI, getImagenModel, VertexAIBackend } from "firebase/ai";

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDg2rXAuoqXeJTtAFfwj70uZ96Q_9kWslU",
  authDomain: "babytouch-63ad3.firebaseapp.com",
  projectId: "babytouch-63ad3",
  storageBucket: "babytouch-63ad3.firebasestorage.app",
  messagingSenderId: "517970121360",
  appId: "1:517970121360:web:e8e5a4c10e7d9e98397e15",
  measurementId: "G-17HW1YMWEB"
};

const firebaseApp = initializeApp(firebaseConfig);

// リージョンを指定してFunctionsのインスタンスを作成
const functions = getFunctions(firebaseApp, 'us-central1');
const functionsJp = getFunctions(firebaseApp, 'asia-northeast1'); // 日本リージョン用

const storage = getStorage(firebaseApp);

// Initialize the Vertex AI Gemini API backend service
const ai = getAI(firebaseApp, { backend: new VertexAIBackend() });

// Create a `GenerativeModel` instance with a model that supports your use case
const model = getImagenModel(ai, { model: "imagen-4.0-generate-001" });

// 音声ファイルのパスを受け取り、画像を生成して、それぞれのStorage URLを返す関数
export const generateImageFromVoice = async(audioFilePath: string)  => {

  // 音声ファイルのダウンロードURLを取得
  const audioStorageRef = ref(storage, audioFilePath);
  const audioUrl = await getDownloadURL(audioStorageRef);

  // 2. Speech-to-Text
  const speechToText = httpsCallable<{filePath: string}, {text: string}>(functions, 'speechToText');
  const resultSpeech = await speechToText({ filePath: audioFilePath });
  const transcription = resultSpeech.data.text;

  // カテゴリごとに候補を用意
  const styles = [
    "絵本風でシンプルな",
    "ふんわり水彩タッチの",
    "クレヨンで描いたような",
    "切り絵風の",
    "レトロゲーム風ドット絵の",
    "明るく元気なアニメ調の"
  ];

  const moods = [
    "子供が喜びそうな暖かく優しい雰囲気の",
    "ワクワクする冒険を感じさせる",
    "夢のようでファンタジーな",
    "自然や四季を感じられる",
    "シンプルでポップな",
    "落ち着いた安心感のある"
  ];

  const palettes = [
    "カラフルな配色で",
    "淡いパステルカラーで",
    "ビビッドな原色を使って",
    "モノクロに一部アクセントカラーを加えて",
    "虹のように多彩な色合いで"
  ];

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 組み合わせてプロンプト生成
  const prompt = `「${transcription}」という言葉から連想される、${pickRandom(styles)}、${pickRandom(moods)}、${pickRandom(palettes)}イラストを生成してください。`;
  //const prompt = `「${transcription}」という言葉から連想される、絵本風で、カラフルでシンプルな、子供が喜びそうな暖かくて優しい雰囲気のイラストを生成してください。`;

  // 3. テキストプロンプトから画像を生成
  const result = await model.generateImages(prompt);

  // 4. 生成された画像をBlobとして取得し、Storageにアップロード
  // result.images[0].data は base64 文字列なので、Blobに変換する
  const byteCharacters = atob(result.images[0].bytesBase64Encoded);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const imageBlob = new Blob([byteArray], { type: 'image/png' });
  
  const imageFileName = `images/generated_${Date.now()}.png`;
  const imageStorageRef = ref(storage, imageFileName);
  await uploadBytes(imageStorageRef, imageBlob);

  // 5. アップロードした画像のURLを取得
  const imageUrl = await getDownloadURL(imageStorageRef);

  // 6. 画像URLと音声URLを返す
  // 戻り値に後で動画生成に使うためのファイルパスも追加
  return { imageUrl, audioUrl, imagePath: imageFileName, audioPath: audioFilePath };
}

// Cloud Functionを呼び出す関数 (これはバックエンド実装用なので今回は使いません)
export const generateImageFromVoiceFunction = httpsCallable<{ filePath: string }, { imageUrl: string, audioUrl: string }>(functions, 'generateImageFromVoice');

// 音声ファイルをFirebase Storageにアップロードする関数
export const uploadAudio = async (audioBlob: Blob) => {
  if (!audioBlob) {
    throw new Error("音声データがありません。");
  }

  let fileExtension = '.webm';
  // Fileオブジェクトの場合、元のファイル名から拡張子を取得
  if (audioBlob instanceof File && audioBlob.name) {
    const nameParts = audioBlob.name.split('.');
    if (nameParts.length > 1) {
      const ext = nameParts.pop();
      if (ext) {
        fileExtension = '.' + ext;
      }
    }
  }

  // バックエンドのSpeech-to-Textが期待するファイルパス形式に合わせる
  const filePath = `voices/recorded_${Date.now()}${fileExtension}`;
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, audioBlob);
  
  return filePath;
};

// ★★★ 追加: 動画生成関数を呼び出す ★★★
export const createVideo = async (imagePath: string, audioPath: string) => {
  const createVideoFunction = httpsCallable<{ imagePath: string, audioPath: string }, { videoUrl: string }>(functionsJp, 'createVideo');
  const result = await createVideoFunction({ imagePath, audioPath });
  return result.data.videoUrl;
};
