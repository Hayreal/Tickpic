export async function copyTextToClipboard(text: string) {
  if (!text.trim()) {
    throw new Error('没有可复制的内容');
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) {
      throw new Error('复制失败');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
