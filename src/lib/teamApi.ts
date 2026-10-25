import {getStoreAccessToken} from './supabase'
export async function teamRequest<T>(payload:Record<string,unknown>):Promise<T>{
 const token=await getStoreAccessToken()
 if(!token)throw Error('Please sign in again.')
 const response=await fetch('/api/team',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)})
 const result=await response.json() as {data?:T;error?:string}
 if(!response.ok||result.error)throw Error(result.error||'The team request could not be completed.')
 return result.data as T
}
