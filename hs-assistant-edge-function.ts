// supabase/functions/hs-assistant/index.ts
// Deploy with: supabase functions deploy hs-assistant
// Set secrets: supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-4o-mini
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
 try{
  const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer "))throw new Error("Sign in is required.");
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,apiKey=Deno.env.get("OPENAI_API_KEY");
  if(!apiKey)throw new Error("AI service is not configured.");
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userErr}=await userClient.auth.getUser(); if(userErr||!user)throw new Error("Invalid session.");
  const body=await req.json();const message=String(body.message||"").trim();if(!message||message.length>2000)throw new Error("Message must be between 1 and 2000 characters.");
  const conversationId=String(body.conversation_id||"");
  const admin=createClient(url,service);
  const {data:conversation,error:convErr}=await admin.from("hs_chat_conversations").select("id,user_id").eq("id",conversationId).single();
  if(convErr||conversation.user_id!==user.id)throw new Error("Conversation access denied.");
  const history=Array.isArray(body.history)?body.history.slice(-8).filter((m:any)=>["user","assistant"].includes(m.role)).map((m:any)=>({role:m.role,content:String(m.content||"").slice(0,2000)})):[];
  const openai=new OpenAI({apiKey});
  const completion=await openai.chat.completions.create({model:Deno.env.get("OPENAI_MODEL")||"gpt-4o-mini",temperature:0.35,max_tokens:500,messages:[
   {role:"system",content:`You are Hindustani Spices Assistant, customer support for a B2B Indian spices sourcing and export enquiry website. Be helpful, concise and professional. Topics: spices, almonds, nuts, dry fruits, availability, wholesale, bulk orders, export, quotations, product specs, packaging, private label, documents, shipping, delivery, complaints and report tracking. Never invent stock, prices, grades, delivery dates, certifications, licences, test reports or regulatory advice. Say that the owner must verify current availability, quotations, shipment details and documents. Ask for product, grade, quantity, destination and pack requirements as relevant. Never request passwords, OTPs or payment card data. Business contact: thestunter925@gmail.com, +91 83745 06945. Exact wording for product specifications: “Discuss grade, origin, crop details, processing, quality parameters and buyer documentation needs before proceeding.” Packaging: “Share your preferred pack size, material, labelling and palletisation requirements for review.” Documentation: “Confirm applicable export, food-safety, inspection and destination-market documents for the specific shipment.” Destination: “Every destination has its own import rules, labelling requirements and buyer expectations. Tell us your destination country and intended use so the requirements can be reviewed before quotation.”`},
   ...history,{role:"user",content:message}
  ]});
  const reply=completion.choices[0]?.message?.content?.trim()||"Please share your product, quantity and destination so our team can review your enquiry.";
  return new Response(JSON.stringify({reply}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unexpected error"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
