const WORKER_URL = "https://ai-error-helper.cutrellmafalda.workers.dev/";
function analyzeError() {
  const input = document.getElementById("errorInput").value.trim();
  const resultBox = document.getElementById("errorResult");

  if (!input) {
    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <h3>还没有粘贴报错</h3>
      <p>请先把完整报错粘贴进来，再点击“开始分析”。</p>
    `;
    return;
  }

  const lower = input.toLowerCase();
  const keyLines = extractKeyLines(input);
  const analysis = detectProblem(lower, input);

  resultBox.style.display = "block";
  resultBox.innerHTML = `
    <h3>分析结果</h3>
    <p><strong>最可能的问题：</strong>${analysis.title}</p>
    <p><strong>严重程度：</strong>${analysis.level}</p>
    <p><strong>人话解释：</strong>${analysis.explain}</p>
    <p><strong>下一步只做这一件事：</strong>${analysis.firstStep}</p>

    <h3>我从日志里抓到的关键行</h3>
    <div class="key-lines">${escapeHtml(keyLines || "暂时没有抓到明显关键行，建议复制更多完整报错。")}</div>

    <h3>你可以复制这段话去问豆包/ChatGPT</h3>
    <div class="copy-prompt">${escapeHtml(analysis.prompt)}</div>
    <button class="button" onclick="copyPrompt()">复制这段提问</button>

    <p class="warning-text">注意：如果里面有 API Key、密码、Token，请先删掉再发给任何人或 AI。</p>
  `;
}

function clearError() {
  const input = document.getElementById("errorInput");
  const resultBox = document.getElementById("errorResult");
  if (input) input.value = "";
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerHTML = "";
  }
}

function extractKeyLines(text) {
  const lines = text.split("\n");
  const keywords = [
    "error", "err!", "failed", "fail", "exception", "syntaxerror",
    "typeerror", "referenceerror", "module not found", "cannot find module",
    "not found", "missing", "unauthorized", "forbidden", "cors", "denied",
    "enoent", "eaddrinuse", "port", "build failed", "command not found",
    "failed to compile", "unexpected token", "permission denied", "api key",
    "environment variable"
  ];

  const matched = lines.filter(line => {
    const lowerLine = line.toLowerCase();
    return keywords.some(keyword => lowerLine.includes(keyword));
  });

  if (matched.length > 0) {
    return matched.slice(0, 14).join("\n");
  }

  return lines.slice(-14).join("\n");
}

function detectProblem(lower, originalText) {
  if (lower.includes("npm: command not found") || lower.includes("'npm' is not recognized")) {
    return item("npm 命令不存在", "低", "电脑不认识 npm，通常是没有安装 Node.js，或者安装后终端没有重启。", "先安装 Node.js，然后关闭终端重新打开，再输入 npm -v 检查。", originalText, "npm 命令不存在，请教我检查 Node.js 和 npm 是否安装成功。");
  }

  if (lower.includes("node: command not found") || lower.includes("'node' is not recognized")) {
    return item("Node.js 没有安装或没有生效", "低", "电脑不认识 node 命令，说明 Node.js 可能没有装好。", "重新安装 Node.js，安装完成后重启终端，输入 node -v 检查。", originalText, "node 命令不存在，请教我检查和安装 Node.js。");
  }

  if (lower.includes("module not found") || lower.includes("cannot find module")) {
    return item("缺少依赖或文件路径错误", "中", "项目需要某个包或文件，但电脑找不到。最常见原因是没有运行 npm install。", "先在项目根目录运行 npm install，然后重新运行项目。", originalText, "项目提示 Module not found / Cannot find module，请判断是缺依赖还是路径错误，并告诉我第一步怎么修。");
  }

  if (lower.includes("missing script") || lower.includes("missing script: dev")) {
    return item("启动命令不对", "低", "你输入了 npm run dev，但 package.json 里可能没有 dev 这个命令。", "打开 package.json，查看 scripts 里面到底有哪些命令。", originalText, "我运行 npm run dev 提示 Missing script，请根据 package.json 告诉我应该运行哪个命令。");
  }

  if (lower.includes("eaddrinuse") || lower.includes("already in use") || lower.includes("port 3000")) {
    return item("端口被占用了", "低", "项目想用的端口已经被别的程序占用，常见是之前开过一个项目没关。", "先关闭旧终端，或者换一个端口重新启动项目。", originalText, "项目提示端口被占用，请教我如何关闭占用端口，或者换一个端口运行。");
  }

  if (lower.includes("api key") || lower.includes("environment variable") || lower.includes("missing key")) {
    return item("API Key 或环境变量问题", "高", "项目需要密钥或环境变量，但你可能没有填写、变量名写错，或者部署平台没有设置。", "检查项目是否需要 .env 文件，并确认变量名和代码里使用的一致。不要把密钥发给别人。", originalText, "项目提示 API Key 或环境变量问题，请告诉我应该创建什么文件、变量名怎么写、部署平台哪里设置。");
  }

  if (lower.includes("401") || lower.includes("unauthorized")) {
    return item("身份验证失败", "中", "通常是 API Key 错了、过期了、没有权限，或者代码没有正确传入密钥。", "先检查 API Key 是否正确，再检查环境变量是否被项目读取到。", originalText, "项目报 401 Unauthorized，请帮我判断是 API Key 错误、权限问题，还是代码传参问题。");
  }

  if (lower.includes("403") || lower.includes("forbidden")) {
    return item("没有访问权限", "中", "服务器拒绝访问，可能是权限不足、接口限制、域名没配置或服务不允许请求。", "先确认接口或服务账号是否有权限，再检查请求地址和配置。", originalText, "项目报 403 Forbidden，请用小白能懂的话解释原因，并告诉我第一步检查哪里。");
  }

  if (lower.includes("404") || lower.includes("not found")) {
    return item("地址、文件或接口不存在", "低", "你访问的页面、文件或接口路径不对，或者部署后路径发生了变化。", "先检查访问的网址、文件名、路由和接口地址是否写对。", originalText, "项目报 404 Not Found，请判断是页面路径问题、文件路径问题，还是接口地址问题。");
  }

  if (lower.includes("cors")) {
    return item("CORS 跨域问题", "中", "浏览器因为安全规则拦住了请求。这个问题通常和前后端接口配置有关。", "先确认你请求的是哪个接口，再让 AI 判断是否需要后端代理或修改服务端跨域设置。", originalText, "项目出现 CORS error，请用小白能懂的话解释，并告诉我最简单的解决思路。");
  }

  if (lower.includes("syntaxerror") || lower.includes("unexpected token")) {
    return item("代码语法错误", "中", "代码里可能少了括号、引号、逗号，或者复制代码时漏了一段。", "看报错里提示的文件名和行号，优先检查那一行附近。", originalText, "项目报 SyntaxError / Unexpected token，请告诉我应该打开哪个文件、看第几行、怎么改。");
  }

  if (lower.includes("build failed") || lower.includes("failed to compile") || lower.includes("deployment failed")) {
    return item("构建或部署失败", "中", "部署平台打包失败，可能是本地没跑通、依赖缺失、build 命令不对，或者环境变量没设置。", "先在本地运行 npm run build，看看本地是否也报错。", originalText, "我部署时报 Build failed / Failed to compile，请帮我从日志中找出真正导致失败的关键错误。");
  }

  if (lower.includes("permission denied")) {
    return item("权限不足", "中", "电脑或服务器不允许你执行某个操作，可能是文件权限、管理员权限或执行权限问题。", "先确认你是在正确文件夹操作，不要随便复制危险命令。", originalText, "我运行命令时提示 Permission denied，请告诉我安全的解决方法，不要给危险命令。");
  }

  if (lower.includes("no such file or directory") || lower.includes("enoent")) {
    return item("文件或文件夹不存在", "低", "代码或命令要找某个文件，但它不在指定位置。", "先确认你当前终端是不是在项目根目录，再检查文件名和路径。", originalText, "项目提示 No such file or directory / ENOENT，请帮我判断是路径错了还是文件缺失。");
  }

  return item("暂时无法准确判断", "未知", "这段日志里没有匹配到常见错误关键词。可能需要更多上下文，或者这是比较特殊的问题。", "建议复制更完整的报错，包括你运行的命令、项目文件列表、最后 30 行日志。", originalText, "我不确定这个报错是什么意思，请你从完整日志中找出最关键的错误行，并用小白能懂的话解释第一步该怎么做。");
}

function item(title, level, explain, firstStep, originalText, task) {
  return {
    title,
    level,
    explain,
    firstStep,
    prompt: buildPrompt(originalText, task)
  };
}

function buildPrompt(originalText, task) {
  return `我是编程小白，我运行 AI 生成的代码时报错了。\n\n请你帮我完成这几件事：\n1. 先从日志中找出真正关键的错误行\n2. 用人话解释这个错误是什么意思\n3. 判断最可能的原因\n4. 告诉我第一步应该做什么\n5. 不要一次给太多方案\n6. 如果涉及 API Key、密码、Token，请提醒我不要泄露\n\n我的问题是：\n${task}\n\n完整报错如下：\n${originalText.slice(0, 3000)}`;
}

function copyPrompt() {
  const promptBox = document.querySelector(".copy-prompt");
  if (!promptBox) {
    alert("还没有生成提问内容。");
    return;
  }

  navigator.clipboard.writeText(promptBox.innerText).then(() => {
    alert("已经复制，可以粘贴给豆包/ChatGPT 了。");
  }).catch(() => {
    alert("复制失败，请手动选中复制。");
  });
}

function toggleDoubaoBox() {
  const box = document.getElementById("doubaoBox");
  if (!box) return;
  box.style.display = box.style.display === "block" ? "none" : "block";
}

function prepareDoubaoPrompt() {
  const question = document.getElementById("doubaoQuestion").value.trim();
  const promptBox = document.getElementById("doubaoPromptBox");

  if (!question) {
    promptBox.style.display = "block";
    promptBox.innerText = "请先输入你的问题或报错。";
    return;
  }

  const prompt = `我是编程小白，正在用 AI 生成代码。\n\n我遇到的问题是：\n\n${question}\n\n请你帮我：\n1. 先判断真正关键的错误在哪里\n2. 用人话解释这个问题是什么意思\n3. 判断最可能的原因\n4. 只告诉我第一步应该做什么\n5. 不要一次给太多方案\n6. 如果涉及 API Key、密码、Token，请提醒我不要泄露\n7. 请用小白能听懂的话回答`;

  promptBox.style.display = "block";
  promptBox.innerText = prompt;

  navigator.clipboard.writeText(prompt).then(() => {
    alert("已经整理并复制好了，可以打开豆包粘贴提问。");
  }).catch(() => {
    alert("已生成提问内容，但复制失败，请手动复制。");
  });
}

function openDoubao() {
  window.open("https://www.doubao.com/chat/", "_blank");
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
async function askRealAI() {
  const input = document.getElementById("errorInput").value.trim();
  const resultBox = document.getElementById("errorResult");

  if (!input) {
    resultBox.style.display = "block";
    resultBox.innerHTML = `
      <h3>还没有粘贴报错</h3>
      <p>请先把完整报错粘贴进来，再点击“AI 真分析”。</p>
    `;
    return;
  }

  resultBox.style.display = "block";
  resultBox.innerHTML = `
    <h3>AI 正在分析...</h3>
    <p>稍等一下，我正在帮你从一大堆报错里找真正关键的问题。</p>
  `;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: input
      })
    });

    const data = await response.json();

    if (!response.ok) {
      resultBox.innerHTML = `
        <h3>AI 分析失败</h3>
        <p>${escapeHtml(data.error || "未知错误")}</p>
        <pre class="copy-prompt">${escapeHtml(JSON.stringify(data.detail || data, null, 2))}</pre>
      `;
      return;
    }

    resultBox.innerHTML = `
      <h3>AI 真分析结果</h3>
      <div class="copy-prompt">${escapeHtml(data.answer)}</div>
      ${
        data.remaining !== null && data.remaining !== undefined
          ? `<p class="small-text">今天剩余免费次数：${data.remaining}</p>`
          : ""
      }
      <button class="button" onclick="copyAIAnswer()">复制分析结果</button>
    `;
  } catch (error) {
    resultBox.innerHTML = `
      <h3>请求失败</h3>
      <p>可能是 Worker 地址填错、CORS 没配置好，或者网络问题。</p>
      <p>${escapeHtml(String(error))}</p>
    `;
  }
}

function copyAIAnswer() {
  const box = document.querySelector(".copy-prompt");

  if (!box) {
    alert("还没有可复制的内容。");
    return;
  }

  navigator.clipboard.writeText(box.innerText).then(() => {
    alert("已经复制。");
  }).catch(() => {
    alert("复制失败，请手动复制。");
  });
}
