import './style.css'
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import confetti from 'canvas-confetti';
import { marked } from 'marked';

// State management
let ffmpeg: FFmpeg | null = null;
let currentResult: string = '';

// DOM Elements
const uploadStep = document.getElementById('upload-step')!;
const processingStep = document.getElementById('processing-step')!;
const resultStep = document.getElementById('result-step')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const statusDetail = document.getElementById('status-detail')!;
const progressBar = document.getElementById('progress-bar')!;
const progressPercent = document.getElementById('progress-percent')!;
const summaryText = document.getElementById('summary-text')!;
const titlesList = document.getElementById('titles-list')!;
const usageCountEl = document.getElementById('usage-count')!;
const downloadBtn = document.getElementById('download-btn')!;
const resetBtn = document.getElementById('reset-btn')!;

// Initialize FFmpeg
async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log(message);
    if (message.includes('frame=')) {
      statusDetail.innerText = '正在提取音频轨道分析中...';
    }
  });

  ffmpeg.on('progress', ({ progress }) => {
    const p = Math.round(progress * 100);
    updateProgress(p, `正在转码音频... ${p}%`);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

function updateProgress(percent: number, detail: string) {
  progressBar.style.width = `${percent}%`;
  progressPercent.innerText = `${percent}%`;
  statusDetail.innerText = detail;
}

// Stats initialization
async function updateStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json() as any;
    usageCountEl.innerText = data.count.toLocaleString();
  } catch (e) {
    usageCountEl.innerText = '许多';
  }
}

// Extract Audio and Analyze
async function processVideo(file: File) {
  try {
    // Switch to processing view
    uploadStep.style.display = 'none';
    processingStep.style.display = 'flex';

    updateProgress(5, '加载 FFmpeg 核心引擎...');
    const fm = await loadFFmpeg();

    updateProgress(15, '读取视频文件中...');
    await fm.writeFile('input_video', await fetchFile(file));

    updateProgress(25, '开始提取音频...');
    // We extract audio as mp3 with decent quality but small size
    // -vn: no video, -acodec libmp3lame: mp3, -q:a 5: variable bitrate approx 128kbps, -ar 16000: 16k sample rate for AI
    await fm.exec(['-i', 'input_video', '-vn', '-acodec', 'libmp3lame', '-q:a', '9', '-ar', '16000', 'output.mp3']);

    updateProgress(60, '正在将音频提交至 AI 分析...');
    const data = await fm.readFile('output.mp3');
    const audioBlob = new Blob([data as any], { type: 'audio/mp3' });

    const response = await fetch('/api/summary', {
      method: 'POST',
      body: audioBlob
    });

    const resultData = await response.json() as any;

    if (!response.ok) throw new Error(resultData.error || '分析失败');

    showResult(resultData.result);
    // Cleanup
    await fm.deleteFile('input_video');
    await fm.deleteFile('output.mp3');

  } catch (err: any) {
    alert('错误: ' + err.message);
    reset();
  }
}



async function showResult(text: string) {
  currentResult = text;
  processingStep.style.display = 'none';
  resultStep.style.display = 'flex';

  // Define sections
  const titleKeywords = /推荐名称|推荐标题|Titles|建议标题|吸引人的视频标题推荐/i;
  const sections = text.split(titleKeywords);

  const summaryRaw = sections[0].replace(/总结|概要|Summary/i, '').trim();
  const titlesPart = sections[1] || '';

  // Use marked for summary
  const summaryHtml = await marked.parse(summaryRaw);
  summaryText.innerHTML = summaryHtml;

  // Extract titles
  // We look for patterns like "1. **Title**" or "* Title"
  const titleMatches = titlesPart.match(/(?:\d\.|\*|\-)\s*(.+)/g);
  let titles: string[] = [];

  if (titleMatches) {
    titles = titleMatches.map(t => {
      // Remove the list marker (e.g., "1. " or "* ")
      const content = t.replace(/^\d\.\s*|\*\s*|\-\s*/, '').trim();
      // Remove markdown bold/italic for the title cards to keep them clean
      return content.replace(/\*\*|\*|__/g, '');
    });
  } else if (titlesPart.trim()) {
    titles = titlesPart.split('\n').filter(t => t.trim()).map(t => t.replace(/\*\*|\*|__/g, '').trim());
  }

  titlesList.innerHTML = '';
  titles.forEach(t => {
    if (t.length < 2) return;
    const item = document.createElement('div');
    item.className = 'title-item';
    item.innerText = t;
    titlesList.appendChild(item);
  });

  if (titles.length === 0) {
    const emptyHint = document.createElement('div');
    emptyHint.style.color = 'var(--text-secondary)';
    emptyHint.innerText = '暂无具体命名推荐，请参考总结内容。';
    titlesList.appendChild(emptyHint);
  }

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#6BA3F9', '#8C9DAF', '#A3B1C6']
  });

  updateStats();
}

function reset() {
  fileInput.value = '';
  uploadStep.style.display = 'block';
  processingStep.style.display = 'none';
  resultStep.style.display = 'none';
  updateProgress(0, '准备就绪');
}

function downloadReport() {
  const blob = new Blob([currentResult], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `视频分析报告_${new Date().toLocaleDateString()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Events
fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) processVideo(file);
});

resetBtn.addEventListener('click', reset);
downloadBtn.addEventListener('click', downloadReport);

// Drag and drop
const dropZone = document.getElementById('drop-zone')!;
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('video/')) {
    processVideo(file);
  } else {
    alert('请上传有效的视频文件');
  }
});

// Init
updateStats();
