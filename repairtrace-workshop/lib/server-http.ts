import { AuthenticationRequiredError } from "./server-identity";

export class UnsafeRequestError extends Error {
  constructor(){super("The request origin could not be verified.");this.name="UnsafeRequestError";}
}

export const privateHeaders={"cache-control":"no-store","x-content-type-options":"nosniff"};

export function assertSameOrigin(request:Request){
  const origin=request.headers.get("origin");
  if(!origin)return;
  const expected=new URL(request.url).origin;
  if(origin!==expected)throw new UnsafeRequestError();
}

export function apiError(error:unknown,fallback:string){
  if(error instanceof AuthenticationRequiredError)return Response.json({error:error.message},{status:401,headers:privateHeaders});
  if(error instanceof UnsafeRequestError)return Response.json({error:error.message},{status:403,headers:privateHeaders});
  if(error instanceof SyntaxError)return Response.json({error:"The request body is not valid JSON."},{status:400,headers:privateHeaders});
  console.error(fallback,error);
  return Response.json({error:fallback},{status:500,headers:privateHeaders});
}

export function cleanText(value:unknown,max:number){
  return String(value??"").replace(/[\u0000-\u001f\u007f]+/g," ").replace(/\s+/g," ").trim().slice(0,max);
}

export function cleanMultiline(value:unknown,max:number){
  return String(value??"").replace(/\u0000/g,"").replace(/\r\n?/g,"\n").replace(/\n{3,}/g,"\n\n").trim().slice(0,max);
}
