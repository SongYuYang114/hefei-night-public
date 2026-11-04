// Fixed cover islands leave the central car lane, chapel doors and objectives open.
export const EXTRA_COVER=Object.freeze([
 [-27,-29,3,1.4,1.4,'crate'],[-26,-26,1.4,3,1.5,'crate'],[-14,-30,3,1.2,1.6,'hedge'],[-8,-26,1.3,3,1.5,'crate'],
 [8,-29,3,1.4,1.4,'crate'],[25,-29,3.5,1.3,1.7,'hedge'],[27,-25,1.4,2.5,1.4,'crate'],[34,-23,2,1.4,1.4,'crate'],
 [-26,29,3.4,1.4,1.5,'crate'],[-23,26,1.3,3.4,1.7,'hedge'],[-12,29,3,1.4,1.4,'crate'],[-5,27,1.4,2.8,1.4,'crate'],
 [8,28,3.4,1.3,1.7,'hedge'],[22,28,3,1.4,1.5,'crate'],[26,25,1.4,3,1.4,'crate'],[34,26,2,1.4,1.4,'crate'],
 [-26,5,3,1.4,1.6,'hedge'],[-26,-1,1.4,2.5,1.4,'crate'],[-31,14,2.4,1.4,1.4,'crate'],[-19,27,2.2,1.4,1.4,'crate'],
 [27,-4,2.6,1.4,1.5,'crate'],[27,13,1.4,3,1.7,'hedge'],[22,8,2.5,1.3,1.4,'crate'],[6,15,1.4,2.5,1.4,'crate']
].map(([x,z,w,d,h,kind])=>Object.freeze({x,z,w,d,h,kind})));
