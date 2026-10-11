import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertTriangle } from 'lucide-react';

/**
 * Calculates variance of Laplacian on 2D canvas image data to detect blur.
 * Higher variance indicates sharper edges; very low variance indicates blur.
 */
function checkBlurLaplacian(canvas) {
  try {
    const width = Math.min(320, canvas.width);
    const height = Math.min(240, canvas.height);

    // Create smaller offscreen canvas for fast computation
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const offCtx = off.getContext('2d');
    offCtx.drawImage(canvas, 0, 0, width, height);

    const imgData = offCtx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    // Convert to grayscale array
    const gray = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    }

    // Apply 3x3 Laplacian kernel [[0, 1, 0], [1, -4, 1], [0, 1, 0]]
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = gray[y * width + x];
        const top = gray[(y - 1) * width + x];
        const bottom = gray[(y + 1) * width + x];
        const left = gray[y * width + (x - 1)];
        const right = gray[y * width + (x + 1)];

        const lap = top + bottom + left + right - 4 * center;
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }

    if (count === 0) return { isBlurry: false, variance: 100 };
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Threshold of ~45 detects noticeably blurry/out-of-focus camera shots
    return { isBlurry: variance < 45.0, variance };
  } catch (err) {
    console.warn('[BlurCheck] Failed to compute Laplacian:', err);
    return { isBlurry: false, variance: 100 };
  }
}

export default function CameraCaptureModal({ isOpen, onClose, onPhotoCaptured, maxPages = 3, lang = 'en' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedPages, setCapturedPages] = useState([]); // array of Blobs
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState(null);
  const [blurWarning, setBlurWarning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPages([]);
      setCurrentPreviewUrl(null);
      setBlurWarning(false);
      setCameraError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[Camera] Access failed:', err);
      setCameraError(
        lang === 'ta'
          ? 'கேமரா அணுகல் மறுக்கப்பட்டது அல்லது கிடைக்கவில்லை.'
          : 'Camera access denied or device unavailable.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Compute blur check
    const { isBlurry } = checkBlurLaplacian(canvas);
    setBlurWarning(isBlurry);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCurrentPreviewUrl(url);
        setIsCapturing(true);
      },
      'image/jpeg',
      0.88
    );
  };

  const handleRetake = () => {
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
    }
    setCurrentPreviewUrl(null);
    setBlurWarning(false);
    setIsCapturing(false);
  };

  const handleAcceptPhoto = async () => {
    if (!currentPreviewUrl) return;

    // Fetch blob from preview URL
    const res = await fetch(currentPreviewUrl);
    const blob = await res.blob();
    const updated = [...capturedPages, blob];
    setCapturedPages(updated);

    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
    }
    setCurrentPreviewUrl(null);
    setBlurWarning(false);
    setIsCapturing(false);

    // If maxPages reached or user ready to finish
    if (updated.length >= maxPages) {
      handleFinishCapture(updated);
    }
  };

  const handleFinishCapture = (pagesToUse = capturedPages) => {
    if (pagesToUse.length === 0 && currentPreviewUrl) {
      handleAcceptPhoto();
      return;
    }
    if (onPhotoCaptured && pagesToUse.length > 0) {
      onPhotoCaptured(pagesToUse);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#23272F]/80 flex items-center justify-center p-3 select-none backdrop-blur-sm">
      <div className="bg-[#F5EBE0] border-2 border-[#23272F] rounded-lg max-w-2xl w-full flex flex-col overflow-hidden shadow-2xl max-h-[95vh]">
        {/* Modal Header */}
        <div className="p-4 bg-[#D6CCC2] border-b border-[#23272F] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#5B2A86]" />
            <h2 className="text-xl font-bold text-[#23272F]">
              {lang === 'ta' ? 'ஆவணத்தை படம் எடுக்கவும்' : 'Take a photo of your document'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target-64 p-2 text-[#23272F] hover:bg-black/10 rounded transition"
            aria-label="Close camera"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative bg-black flex-1 min-h-[360px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="text-center p-6 text-white max-w-sm">
              <AlertTriangle className="w-12 h-12 text-[#B3261E] mx-auto mb-3" />
              <p className="text-lg font-semibold">{cameraError}</p>
            </div>
          ) : isCapturing && currentPreviewUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={currentPreviewUrl}
                alt="Captured document"
                className="max-h-[500px] w-auto object-contain"
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover min-h-[360px]"
              />
              {/* On-Screen Frame Guide */}
              <div className="absolute inset-6 md:inset-10 border-2 border-dashed border-[#D5BDAF] pointer-events-none rounded flex flex-col justify-between p-3">
                <span className="bg-[#23272F]/80 text-[#F5EBE0] text-xs px-2 py-1 rounded self-start font-mono">
                  {lang === 'ta' ? 'ஆவணத்தை சட்டத்திற்குள் வைக்கவும்' : 'Document guide frame'}
                </span>
                <span className="text-white/80 text-xs text-center">
                  {lang === 'ta' ? 'கையை அசைக்காமல் நேராகப் பிடிக்கவும்' : 'Hold steady and align'}
                </span>
              </div>
            </div>
          )}

          {/* Blur Warning Overlay */}
          {blurWarning && (
            <div className="absolute top-4 left-4 right-4 bg-[#B3261E] text-white p-3 rounded flex items-center gap-2 shadow-lg animate-pulse z-10">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="font-bold text-sm md:text-base">
                {lang === 'ta'
                  ? 'படம் மங்கலாக உள்ளது. கையை அசைக்காமல் மீண்டும் எடுக்கவும்.'
                  : 'The photo is blurry. Hold steady and try again.'}
              </p>
            </div>
          )}
        </div>

        {/* Multi-page indicators & controls */}
        <div className="p-4 bg-[#D6CCC2] border-t border-[#23272F] flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm font-semibold text-[#23272F]">
            <span>
              {lang === 'ta' ? `பக்கங்கள்: ${capturedPages.length} / ${maxPages}` : `Pages captured: ${capturedPages.length} of ${maxPages}`}
            </span>
            {capturedPages.length > 0 && (
              <span className="text-[#1F3FBF]">
                {lang === 'ta' ? 'நினைவகத்தில் உள்ளது (சேமிக்கப்படவில்லை)' : 'Held in memory only'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            {isCapturing ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="touch-target-64 px-4 py-3 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded flex items-center gap-2 hover:bg-gray-100 transition active:scale-95"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>{lang === 'ta' ? 'மீண்டும் எடுக்கவும்' : 'Retake'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAcceptPhoto}
                  className="touch-target-64 px-6 py-3 bg-[#5B2A86] text-white font-bold border-2 border-[#5B2A86] rounded flex items-center gap-2 hover:opacity-90 transition active:scale-95"
                >
                  <Check className="w-5 h-5" />
                  <span>
                    {capturedPages.length + 1 < maxPages
                      ? (lang === 'ta' ? 'சேர்த்து அடுத்த பக்கம் எடுக்கவும்' : 'Add & Take Next Page')
                      : (lang === 'ta' ? 'பயன்படுத்து' : 'Use Photo')}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="touch-target-64 px-4 py-3 bg-[#F5EBE0] text-[#23272F] font-bold border-2 border-[#23272F] rounded hover:bg-gray-100 transition"
                >
                  {lang === 'ta' ? 'ரத்து' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={captureFrame}
                  disabled={!!cameraError}
                  className="touch-target-64 flex-1 max-w-xs py-3 bg-[#1F3FBF] text-white text-lg font-bold border-2 border-[#1F3FBF] rounded flex items-center justify-center gap-2 hover:bg-blue-800 transition active:scale-95 disabled:opacity-50"
                >
                  <Camera className="w-6 h-6" />
                  <span>{lang === 'ta' ? 'படம் எடுக்கவும்' : 'Capture photo'}</span>
                </button>

                {capturedPages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleFinishCapture()}
                    className="touch-target-64 px-4 py-3 bg-[#5B2A86] text-white font-bold border-2 border-[#5B2A86] rounded flex items-center gap-1 hover:opacity-90 transition active:scale-95"
                  >
                    <Check className="w-5 h-5" />
                    <span>{lang === 'ta' ? 'முடிக்கவும்' : 'Done'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
