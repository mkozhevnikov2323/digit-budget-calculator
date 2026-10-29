// Disposable IPC child only; never loaded by production or Vite.
if(process.env.BUDGET_BROWSER_TEST!=='1'||process.env.MONGODB_INTEGRATION_TEST!=='1'||!process.send)throw Error('Test-only C fixture');
process.env.CLASSIFICATION_C_WRITE_ENABLED=process.env.BUDGET_BROWSER_DEFAULT_OFF==='1'?'0':'1';
const {performance}=require('node:perf_hooks');const {mock}=require('node:test');
const now=performance.now.bind(performance);let offset=0;
mock.method(performance,'now',()=>now()+offset);
process.on('message',message=>{if(message.command==='expireProof')offset+=301000;});
