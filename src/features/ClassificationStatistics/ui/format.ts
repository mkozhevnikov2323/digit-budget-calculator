import {formatKopecks} from 'features/FinancialAnalytics/model/money';
export const money=(n:number)=>{const f=formatKopecks(n);return f.ok?f.value:'Недоступно';};
export const percent=(n:number|null)=>n===null?'—':`${(n*100).toFixed(1).replace('.',',')}%`;
