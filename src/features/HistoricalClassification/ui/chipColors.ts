import { alpha, type Theme } from '@mui/material/styles';
type Tone='primary'|'secondary'|'info'|'warning'|'success'|'error'|'grey';
const roles: Record<string,Tone>={ordinary_expense:'primary',ordinary_income:'success',loan_issuance:'warning',loan_repayment:'info',refund:'secondary',internal_transfer:'grey',capital_movement:'error'};
const layers: Record<string,Tone>={everyday:'primary',irregular:'secondary',emergency:'warning',major_goals:'info',long_term_capital:'success'};
const tint=(theme:Theme,key:Tone)=> key==='grey'?theme.palette.grey[700]:theme.palette[key].main;
export const roleChip=(value:string)=>(theme:Theme)=>({color:tint(theme,roles[value]??'grey'),borderColor:alpha(tint(theme,roles[value]??'grey'),0.45),height:24});
export const layerChip=(value:string)=>(theme:Theme)=>({color:tint(theme,layers[value]??'grey'),backgroundColor:alpha(tint(theme,layers[value]??'grey'),0.12),height:24});
