export const TEAM_MODULES = [
  {id:'products',label:'Products',description:'Products, sizes, stock and product media',path:'/admin/products'},
  {id:'categories',label:'Categories',description:'Rug collections and category images',path:'/admin/categories'},
  {id:'orders',label:'Orders',description:'Orders, fulfilment and internal notes',path:'/admin/orders'},
  {id:'customers',label:'Customers',description:'Customer directory and purchase summaries',path:'/admin/customers'},
  {id:'content',label:'Website Content',description:'Pages and homepage banners',path:'/admin/pages'},
  {id:'reviews',label:'Reviews',description:'Review moderation and replies',path:'/admin/reviews'},
  {id:'analytics',label:'Dashboard & Analytics',description:'Revenue reports and performance',path:'/admin/analytics'},
  {id:'settings',label:'Store Settings',description:'Store information, delivery and promotions',path:'/admin/settings'},
] as const
export type TeamPermission = typeof TEAM_MODULES[number]['id']
export function permissionForAdminPath(path:string):TeamPermission|'admin'|null {
  if(path==='/admin'||path==='/admin/')return 'analytics'
  if(path.startsWith('/admin/profile'))return null
  if(path.startsWith('/admin/team'))return 'admin'
  if(path.startsWith('/admin/banners'))return 'content'
  return TEAM_MODULES.find(m=>path===m.path||path.startsWith(m.path+'/'))?.id??'admin'
}
export function firstTeamRoute(permissions:readonly string[]) {return TEAM_MODULES.find(m=>permissions.includes(m.id))?.path??'/admin/profile'}

export const TEAM_ROLES = [
 {id:'owner',label:'Owner',description:'Full control of the store and team. Owner accounts are protected.'},
 {id:'super_admin',label:'Super Admin',description:'Manage the store, settings and Admin team members.'},
 {id:'admin',label:'Admin',description:'Manage products, orders, customers, content, reviews and analytics.'},
] as const
export type TeamRole=typeof TEAM_ROLES[number]['id']
export function parseTeamRole(value:unknown):TeamRole {
 if(!TEAM_ROLES.some(role=>role.id===value))throw new Error('Choose a valid team role.')
 return value as TeamRole
}
export function permissionsForRole(role:TeamRole|null):TeamPermission[]{return role?TEAM_MODULES.filter(m=>role!=='admin'||m.id!=='settings').map(m=>m.id):[]}
export function canAssignRole(actor:TeamRole|null,target:TeamRole){return actor==='owner'||actor==='super_admin'&&target==='admin'}
export function roleLabel(role:TeamRole){return TEAM_ROLES.find(r=>r.id===role)!.label}
