require('dotenv').config();
const path=require('node:path');
const bcrypt=require('bcryptjs');
const express=require('express');
const app=require('./app');
const {pool,initializeDatabase}=require('./db');
async function bootstrapAdmin(){
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
  if(!email||!password){console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set; provision an administrator before use.');return;}
  if(password.length<12)throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  const exists=await pool.query('SELECT id FROM admin_users LIMIT 1');if(exists.rowCount)return;
  await pool.query('INSERT INTO admin_users(email,password_hash,role) VALUES($1,$2,$3)',[email,await bcrypt.hash(password,12),'admin']);
  console.log('Initial administrator created from environment configuration.');
}
async function start(){
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
  if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must be at least 32 characters.');
  await initializeDatabase();await bootstrapAdmin();
  const page=path.join(__dirname,'..','admin','index.html');
  app.get(['/admin','/admin/'],(req,res)=>res.sendFile(page));
  const server=app.listen(Number(process.env.PORT||4000),()=>console.log('Silvateralink API ready.'));
  const stop=()=>server.close(async()=>{await pool.end();process.exit(0);});
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
start().catch(error=>{console.error('Startup failed:',error);process.exit(1);});