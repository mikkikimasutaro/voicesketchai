import React, { useState, useRef } from 'react';
// createVideo をインポート
import { uploadAudio, generateImageFromVoice, createVideo } from './firebase';
import './App.css';

// マイクのアイコン (SVG)
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-white">
    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.75 6.75 0 1 1-13.5 0v-1.5A.75.75 0 0 1 6 10.5Z" />
  </svg>
);

// ダウンロードアイコン (SVG)
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2">
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
  </svg>
);


export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // result の型に imagePath と audioPath を追加
  const [result, setResult] = useState<{ imageUrl: string; audioUrl: string; imagePath: string; audioPath: string; } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ★★★ 追加: 動画生成用のstate ★★★
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processAudio = async (audioBlob: Blob) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const filePath = await uploadAudio(audioBlob);
      const response = await generateImageFromVoice(filePath);
      setResult(response);
    } catch (err) {
      console.error("Error:", err);
      setError("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  // ★★★ 追加: 動画ダウンロード処理 ★★★
  const handleDownloadVideo = async () => {
    if (!result) return;

    setIsCreatingVideo(true);
    setVideoError(null);
    try {
      const videoUrl = await createVideo(result.imagePath, result.audioPath);
      
      // aタグを作成して自動的にクリックさせ、ダウンロードを開始
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = 'baby-voice-art.mp4'; // ダウンロード時のファイル名
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Video creation error:", err);
      setVideoError("動画の生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsCreatingVideo(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    setResult(null);
    setSelectedFile(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      audioChunksRef.current = [];

      mediaRecorderRef.current.addEventListener("dataavailable", event => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorderRef.current.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        processAudio(audioBlob);
      });

      mediaRecorderRef.current.start();
      setIsRecording(true);

      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 10000);

    } catch (err) {
      console.error("マイクへのアクセスに失敗しました:", err);
      setError("マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。");
    }
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleRecordButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      setResult(null);
      setSelectedFile(file);
    }
  };

  const handleSubmitFile = () => {
    if (selectedFile) {
      processAudio(selectedFile);
      setSelectedFile(null); 
    }
  };

  return (
    <div className="w-full min-h-screen bg-sky-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Voice Skech AI</h1>
        <p className="text-gray-500 mb-8">声を元にAIが絵を描いてくれます。</p>

        {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4 animate-pulse">{error}</p>}

        {isLoading ? (
          <div className="my-8 space-y-4">
            <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-500 mx-auto"></div>
            <p className="text-lg text-gray-600">AIが絵を創作中...</p>
          </div>
        ) : result ? (
          <div className="my-6 space-y-4">
            <img src={result.imageUrl} alt="Generated Art" className="w-full rounded-lg shadow-lg mb-4 border-4 border-white" />
            <audio controls src={result.audioUrl} className="w-full">
              ブラウザが音声再生に対応していません。
            </audio>
            
            {/* ★★★ 追加: ダウンロードボタンとメッセージ ★★★ */}
            <div className="mt-4">
              <button
                onClick={handleDownloadVideo}
                disabled={isCreatingVideo}
                className="w-full flex items-center justify-center px-4 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
              >
                {isCreatingVideo ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    <span>動画を生成中...</span>
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    <span>動画をダウンロード</span>
                  </>
                )}
              </button>
              {videoError && <p className="text-red-500 text-sm mt-2">{videoError}</p>}
            </div>

          </div>
        ) : (
           <div className="my-12 h-48 flex flex-col justify-center items-center">
            <p className="text-lg text-gray-500">下のボタンをおして、</p>
            <p className="text-lg text-gray-500">声を聞かせてね！</p>
          </div>
        )}

        <button
          onClick={handleRecordButtonClick}
          disabled={isLoading || !!selectedFile}
          className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto transition-all duration-300 ease-in-out shadow-2xl transform hover:scale-105
            ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'}
            ${isLoading || selectedFile ? 'bg-gray-400 cursor-not-allowed' : ''}
          `}
        >
          <MicIcon />
        </button>
        <p className="mt-5 text-gray-600 h-6">
          {isLoading ? '' : isRecording ? '録音中... (最大10秒)' : 'タップして録音開始'}
        </p>

{/*         <div className="mt-6 text-sm text-gray-600">
          <p>または</p>
          <label htmlFor="audio-upload" className={`font-semibold cursor-pointer ${isLoading ? 'text-gray-400' : 'text-blue-500 hover:text-blue-700'}`}>
            音声ファイルをアップロード
          </label>
          <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={handleFileChange} disabled={isLoading || isRecording} />
          {selectedFile && !isLoading && (
            <div className="mt-2 text-left">
              <p className="truncate text-sm">選択中のファイル: {selectedFile.name}</p>
              <button onClick={handleSubmitFile} className="w-full mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                このファイルでアートを作成
              </button>
            </div>
          )}
        </div>
 */}
 
      </div>
      <footer className="text-center mt-6 text-gray-500 text-sm">
        <p>&copy; 2025 EchoSckechAI</p>
      </footer>
    </div>
  );
}