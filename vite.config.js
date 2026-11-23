import { defineConfig, loadEnv } from 'vite';
import { createHandler } from './api/feedback.js';
import { feedbackMiddleware } from './server/devMiddleware.js';
export default defineConfig(({mode}) => ({
  plugins:[{name:'local-feedback-api',configureServer(server){
    server.middlewares.use(feedbackMiddleware(createHandler({env:{...process.env,...loadEnv(mode,process.cwd(),'')}})));
    server.middlewares.use((req,res,next)=>{
      if(req.url==='/admin/feedback')req.url='/admin/feedback/index.html';
      next();
    });
  }}],
  define: { __BUILD_ID__:JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || 'local-development') },
  build: { rollupOptions: { input: { game:'index.html', admin:'admin/feedback/index.html' } } },
}));
