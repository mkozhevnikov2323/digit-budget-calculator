// Disposable IPC child only; never loaded by production or Vite.
if(process.env.BUDGET_BROWSER_TEST!=='1'||process.env.MONGODB_INTEGRATION_TEST!=='1'||!process.send)throw Error('Test-only C fixture');
process.env.CLASSIFICATION_C_WRITE_ENABLED=process.env.BUDGET_BROWSER_DEFAULT_OFF==='1'?'0':'1';
