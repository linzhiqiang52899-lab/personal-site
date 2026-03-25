const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const { marked } = require('marked');
const hljs = require('highlight.js');

const app = express();
const PORT = process.env.PORT || 3000;
const CONTENT_DIR = path.join(__dirname, 'content');

// 配置 marked 使用 highlight.js
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {}
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// 内存中的文件索引
let fileIndex = [];

// 扫描内容目录
let isScanning = false;
async function scanContentDir() {
  if (isScanning) return;
  isScanning = true;

  try {
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    const files = await fs.readdir(CONTENT_DIR, { withFileTypes: true });

    fileIndex = [];
    const seen = new Set();

    for (const file of files) {
      if (file.isFile()) {
        const ext = path.extname(file.name).toLowerCase();
        if (ext === '.md' || ext === '.html') {
          const filePath = path.join(CONTENT_DIR, file.name);
          const stats = await fs.stat(filePath);
          const title = path.basename(file.name, ext);

          // 去重
          if (seen.has(file.name)) continue;
          seen.add(file.name);

          fileIndex.push({
            title: title,
            filename: file.name,
            type: ext.substring(1),
            url: `/${title}`,
            mtime: stats.mtime,
            size: stats.size
          });
        }
      }
    }

    // 按修改时间排序，最新的在前
    fileIndex.sort((a, b) => b.mtime - a.mtime);

    console.log(`[扫描完成] 找到 ${fileIndex.length} 个文件`);
  } catch (error) {
    console.error('扫描目录出错:', error);
  } finally {
    isScanning = false;
  }
}

// 获取文件内容
async function getFileContent(filename) {
  const filePath = path.join(CONTENT_DIR, filename);
  const content = await fs.readFile(filePath, 'utf-8');
  return content;
}

// 生成完整的 HTML
function generateHTML(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 个人内容</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f7fa;
      padding: 0;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1.5rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header h1 { font-size: 1.5rem; }
    .header a { color: white; text-decoration: none; opacity: 0.9; }
    .header a:hover { opacity: 1; }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 1.5rem;
    }
    .content-card {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .content-card h1, .content-card h2, .content-card h3 {
      margin: 1.5rem 0 0.75rem 0;
      color: #2c3e50;
    }
    .content-card h1:first-child, .content-card h2:first-child, .content-card h3:first-child {
      margin-top: 0;
    }
    .content-card p { margin: 0.75rem 0; }
    .content-card ul, .content-card ol { margin: 0.75rem 0; padding-left: 1.5rem; }
    .content-card li { margin: 0.25rem 0; }
    .content-card a { color: #667eea; text-decoration: none; }
    .content-card a:hover { text-decoration: underline; }
    .content-card code {
      background: #f4f4f4;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    .content-card pre {
      background: #282c34;
      color: #abb2bf;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    .content-card pre code {
      background: none;
      padding: 0;
      color: inherit;
    }
    .content-card blockquote {
      border-left: 4px solid #667eea;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #666;
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 0 8px 8px 0;
    }
    .content-card img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1rem 0;
    }
    .content-card table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      display: block;
      overflow-x: auto;
      white-space: nowrap;
    }
    .content-card th, .content-card td {
      border: 1px solid #e1e4e8;
      padding: 0.75rem;
      text-align: left;
      min-width: 100px;
    }
    .content-card th {
      background: #f6f8fa;
      font-weight: 600;
    }
    .content-card hr {
      border: none;
      border-top: 2px solid #e1e4e8;
      margin: 2rem 0;
    }
    .footer {
      text-align: center;
      padding: 2rem;
      color: #666;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <header class="header">
    <a href="/"><h1>📚 个人内容</h1></a>
  </header>
  <div class="container">
    <div class="content-card">
      ${bodyContent}
    </div>
  </div>
  <footer class="footer">
    <p>分享链接: <code>${process.env.HOST || 'http://localhost:3000'}/${title}</code></p>
  </footer>
</body>
</html>`;
}

// 首页
app.get('/', (req, res) => {
  let listHTML = '<h1>📖 内容列表</h1>';

  if (fileIndex.length === 0) {
    listHTML += '<p style="color: #999; text-align: center; padding: 2rem;">暂无内容，请将 .md 或 .html 文件放入 content 目录</p>';
  } else {
    listHTML += '<div style="margin: 1rem 0;">';
    fileIndex.forEach((file, index) => {
      const icon = file.type === 'md' ? '📝' : '🌐';
      const date = file.mtime.toLocaleDateString('zh-CN') + ' ' + file.mtime.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'});
      listHTML += `
        <div style="
          background: ${index === 0 ? '#f0f4ff' : 'white'};
          padding: 1rem;
          margin: 0.5rem 0;
          border-radius: 8px;
          border: 1px solid ${index === 0 ? '#667eea' : '#e1e4e8'};
          cursor: pointer;
          transition: all 0.2s;
        ">
          <a href="${file.url}" style="text-decoration: none; color: inherit; display: block;">
            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem;">
              ${icon} ${file.title}
            </div>
            <div style="font-size: 0.85rem; color: #666;">
              ${file.type.toUpperCase()} · ${file.mtime.toLocaleDateString('zh-CN')}
            </div>
          </a>
        </div>`;
    });
    listHTML += '</div>';
  }

  res.send(generateHTML('首页', listHTML));
});

// 内容页面
app.get('/:title', async (req, res) => {
  const title = req.params.title;

  const file = fileIndex.find(f => f.title === title);

  if (!file) {
    res.status(404).send(generateHTML('未找到', '<h1>404</h1><p>内容不存在</p><p><a href="/">返回首页</a></p>'));
    return;
  }

  try {
    const content = await getFileContent(file.filename);
    let bodyContent;

    if (file.type === 'md') {
      bodyContent = marked(content);
    } else {
      bodyContent = content;
    }

    res.send(generateHTML(title, bodyContent));
  } catch (error) {
    res.status(500).send(generateHTML('错误', '<h1>读取失败</h1><p>无法读取文件内容</p>'));
  }
});

// 启动服务器
async function startServer() {
  await scanContentDir();

  // 监听文件变化
  const watcher = chokidar.watch(CONTENT_DIR, {
    ignored: /(^|[\\/\\])\../,
    persistent: true
  });

  watcher.on('add', () => scanContentDir());
  watcher.on('change', () => scanContentDir());
  watcher.on('unlink', () => scanContentDir());

  console.log('文件监听已启动...');

  app.listen(PORT, () => {
    console.log(`\n✅ 服务器已启动`);
    console.log(`🌐 访问地址: http://localhost:${PORT}`);
    console.log(`📂 内容目录: ${CONTENT_DIR}`);
    console.log(`\n💡 提示: 将 .md 或 .html 文件放入 content 目录即可自动访问\n`);
  });
}

startServer();
