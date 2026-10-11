const copy = document.getElementById('copy-wallet');
copy?.addEventListener('click', async () => {
  const field = document.getElementById('wallet-address');
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(field.value);
    status.textContent = 'Адрес скопирован. Сеть: BNB Smart Chain (BEP20).';
  } catch {
    field.focus(); field.select();
    status.textContent = 'Адрес выделен: скопируйте его вручную. Сеть: BNB Smart Chain (BEP20).';
  }
});
