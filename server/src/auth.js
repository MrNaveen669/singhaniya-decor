import jwt from 'jsonwebtoken';
export function auth(req,res,next){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return res.status(401).json({message:'Unauthorized'});try{req.user=jwt.verify(t,process.env.JWT_SECRET);next()}catch{return res.status(401).json({message:'Invalid token'})}}
