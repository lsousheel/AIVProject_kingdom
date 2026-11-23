// Vite development only. Production requests are handled by Vercel's /api function.
export function feedbackMiddleware(handler) {
  return async (req,res,next) => {
    if(req.url?.split('?')[0]!=='/api/feedback')return next();
    let size=0;const chunks=[];
    try {
      for await(const chunk of req){
        size+=chunk.length;
        if(size>24000){res.statusCode=413;res.end('{"error":"Request too large."}');return;}
        chunks.push(chunk);
      }
      req.body=Buffer.concat(chunks).toString()||{};
      await handler(req,res);
    }catch{res.statusCode=400;res.end('{"error":"Invalid request."}');}
  };
}
