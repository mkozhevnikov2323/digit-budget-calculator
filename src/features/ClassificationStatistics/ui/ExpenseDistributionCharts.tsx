import {Box,Stack,Typography} from '@mui/material';
import {PieChart} from '@mui/x-charts/PieChart';
import {BarChart} from '@mui/x-charts/BarChart';
import {money,percent} from './format';
type Row={label:string;kopecks:number;amountShare:number|null};
const colors=['#1976d2','#9c27b0','#ed6c02','#2e7d32','#d32f2f','#0288d1','#6d4c41','#546e7a'];
/** Both plots and the shared scrollable legend use the full table aggregates. */
export const ExpenseDistributionCharts=({title,rows,count}:{title:string;rows:readonly Row[];count:number})=>{
 const positive=rows.some(row=>row.kopecks>0);
 const description=(row:Row)=>`${row.label}: ${money(row.kopecks)} (${percent(row.amountShare)})`;
 const empty=count===0?'Нет расходов за выбранный период.':'Суммы расходов равны нулю. Доли сумм не определены.';
 return <Stack spacing={1} sx={{minWidth:0}}>
  <Stack direction={{xs:'column',md:'row'}} spacing={2} sx={{minWidth:0}}>
   <Box sx={{flex:1,minWidth:0}}><Typography component="h3" variant="subtitle1">Доли сумм</Typography>
    {positive?<PieChart height={300} hideLegend skipAnimation aria-label={`Круговая диаграмма: ${title}`} series={[{data:rows.map((r,index)=>({id:index,label:r.label,value:r.kopecks,color:colors[index%colors.length]})),valueFormatter:item=>rows[Number(item.id)]?description(rows[Number(item.id)]):'—'}]} margin={{top:10,bottom:10,left:10,right:10}}/>:<Typography>{empty}</Typography>}
   </Box>
   <Box sx={{flex:1,minWidth:0}}><Typography component="h3" variant="subtitle1">Суммы расходов</Typography>
    {positive?<BarChart height={300} hideLegend skipAnimation aria-label={`Столбчатая диаграмма: ${title}`}
     xAxis={[{scaleType:'band',data:rows.map((_r,index)=>index),colorMap:{type:'ordinal',values:rows.map((_r,index)=>index),colors:rows.map((_r,index)=>colors[index%colors.length])},valueFormatter:(value,context)=>{const label=rows[value]?.label??'';return context.location==='tick'&&label.length>16?label.slice(0,15)+'…':label;},tickLabelStyle:{angle:-30,fontSize:10}}]}
     yAxis={[{valueFormatter:(value:number)=>Number.isSafeInteger(value)?money(value):''}]}
     series={[{data:rows.map(r=>r.kopecks),valueFormatter:(_value,context)=>rows[context.dataIndex]?description(rows[context.dataIndex]):'—'}]}
     margin={{bottom:75,left:70,right:10,top:10}}/>:<Typography>{empty}</Typography>}
   </Box>
  </Stack>
  {positive&&<Box component="ul" aria-label={`Легенда: ${title}`} sx={{display:'flex',flexWrap:'wrap',gap:1,listStyle:'none',p:0,m:0,maxHeight:160,overflowY:'auto'}}>
   {rows.map((row,index)=><Box component="li" key={index} sx={{display:'flex',gap:0.5,alignItems:'baseline',overflowWrap:'anywhere'}}><Box component="span" aria-hidden sx={{backgroundColor:colors[index%colors.length],width:10,height:10,flexShrink:0}}/><Typography variant="caption">{description(row)}</Typography></Box>)}
  </Box>}
 </Stack>;
};
