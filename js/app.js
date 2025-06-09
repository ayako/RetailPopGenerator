document.addEventListener('DOMContentLoaded', async () => {
  const objectivesInput = document.getElementById('objectives');
  const genInputsBtn = document.getElementById('generate-inputs-btn');
  const copyTextMain = document.getElementById('copy-text-main');
  const copyTextSub = document.getElementById('copy-text-sub');
  const imagePrompt = document.getElementById('image-prompt');
  const videoPrompt = document.getElementById('video-prompt');
  const genBtn = document.getElementById('generate-btn');
  const imageOutput = document.getElementById('image-output');
  const templateContainer = document.getElementById('template-container');
  const editPrompt   = document.getElementById('edit-prompt');
  const editImageBtn = document.getElementById('edit-image-btn');
  const toggleGenerate = document.getElementById('toggle-generate');
  const toggleLabel = document.querySelector('.toggle-label');

  // Load template.json and render as checkboxes
  const tplRes = await fetch('/template.json');
  const templates = await tplRes.json();
  templates.forEach(tpl => {
    const label = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.name = 'template';
    chk.value = tpl.name;
    label.appendChild(chk);
    label.append(` ${tpl.name}`);
    templateContainer.appendChild(label);
  });

  // ページロード時にTempクリア
  await fetch('/api/clearTemp', { method: 'POST' });

  // Generate inputs
  genInputsBtn.addEventListener('click', async () => {
    const objectives = objectivesInput.value.trim();
    if (!objectives) return;
    genInputsBtn.disabled = true;
    const res = await fetch('/api/generateInputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectives })
    });
    const data = await res.json();
    copyTextMain.value = data.copy_text_main;
    copyTextSub.value = data.copy_text_sub;
    imagePrompt.value = data.image_prompt_ja;
    videoPrompt.value = data.video_prompt_ja;
    genInputsBtn.disabled = false;
    genBtn.disabled = false;
  });

  // enable button only when there's any non-blank text
  objectivesInput.addEventListener('input', () => {
    genInputsBtn.disabled = objectivesInput.value.trim() === '';
  });

  // 有効条件：メインテキスト／画像説明いずれも非空
  function updateGenPopState() {
    genBtn.disabled = !(
      copyTextMain.value.trim() &&
      imagePrompt.value.trim()
    );
  }
  copyTextMain.addEventListener('input', updateGenPopState);
  imagePrompt.addEventListener('input', updateGenPopState);

  genBtn.addEventListener('click', async () => {
    genBtn.disabled = true;
    imageOutput.innerHTML = '';

    // 準備：選択テンプレート
    const chosen = Array.from(
      document.querySelectorAll('input[name="template"]:checked')
    ).map(el => el.value);

    const choices = chosen.length ? chosen : [null];

    // プレースホルダー表示用コンテナを先に作成
    const containers = choices.map(tplName => {
      const container = document.createElement('div');
      container.classList.add('loading');
      // スピナー
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      container.appendChild(spinner);
      imageOutput.appendChild(container);
      return { tplName, container };
    });

    // 並行fetch→結果差し替え
    await Promise.all(containers.map(async ({ tplName, container }) => {

      // Toggle ON = Video, OFF = Image
      if (toggleGenerate.checked) {
        // Generate Video
        // const promptBase = `${videoPrompt.value}`;
        const promptBase = `${videoPrompt.value} Clearly show text as Main Text: ${copyTextMain.value}, Sub Text: ${copyTextSub.value}`;        const prompt = tplName
          ? `${promptBase} Key Colors: ${templates.find(tpl => tpl.name === tplName).color}  Dominant color: #FFFFFF`
          : promptBase;
        const res = await fetch('/api/generateVideo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, template: tplName || 'default' })
        });
        const data = await res.json();

        // 差し替え
        container.innerHTML = '';
        const tpl = document.createElement('p');
        tpl.textContent = tplName || 'Default';
        const video = document.createElement('video');
        video.src = data.url;
        video.controls = true;
        container.appendChild(tpl);
        container.appendChild(video);
      }
      else {
        // Generate Image
        const promptBase = `${imagePrompt.value} Clearly shown Main Text: ${copyTextMain.value}, Sub Text: ${copyTextSub.value}`;
        const prompt = tplName
          ? `${promptBase} Key Colors: ${templates.find(tpl => tpl.name === tplName).color}  Dominant color: #FFFFFF`
          : promptBase;
        const res = await fetch('/api/generateImage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, template: tplName || 'default' })
        });
        const data = await res.json();

        // 差し替え
        container.innerHTML = '';
        const tpl = document.createElement('p');
        tpl.textContent = tplName || 'Default';
        const img = document.createElement('img');
        img.src = data.url;
        container.appendChild(tpl);
        container.appendChild(img);

        // once images are rendered, enable edit prompt
        editPrompt.disabled = false;
        // clear any previous value
        editPrompt.value = '';
        editImageBtn.disabled = false;
      }
 
    }));

    genBtn.disabled = false;
  });


  // after rendering images and enabling editPrompt/editImageBtn
  editImageBtn.addEventListener('click', async () => {
    editImageBtn.disabled = true;
    const promptText = editPrompt.value.trim();

    // 末尾にスピナー用コンテナを追加
    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('loading');
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    loadingContainer.appendChild(spinner);
    imageOutput.appendChild(loadingContainer);

    // call edit API
    const filePath = new URL(
      // pick any existing img; original remains intact
      imageOutput.querySelector('img').src
    ).pathname.slice(1);
    const res = await fetch('/api/editImage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText, filePath })
    });
    const { url } = await res.json();

    // 完了後、スピナーを差し替え
    loadingContainer.innerHTML = '';
    const newCaption = document.createElement('p');
    newCaption.textContent = 'Edited';
    const newImg = document.createElement('img');
    newImg.src = url + '?t=' + Date.now();
    loadingContainer.appendChild(newCaption);
    loadingContainer.appendChild(newImg);

    editImageBtn.disabled = false;
  });

  // Update toggle button text based on state
  toggleGenerate.addEventListener('change', () => {
    if (toggleGenerate.checked) {
      toggleLabel.textContent = 'Video';
    } else {
      toggleLabel.textContent = 'Image';
    }
  });

  // Initialize toggle button text
  toggleLabel.textContent = toggleGenerate.checked ? 'Video' : 'Image';

  // Modify download functionality for images to open Save As dialog
  imageOutput.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'IMG') {
      const link = document.createElement('a');
      link.href = target.src;
      link.download = '';
      link.click();
    }
  });

});
