/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Immutable Provider Registry
 * Introduction: Provides deterministic read-only provider and capability indexes.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { assertProviderDescriptor } from "./validation.js"; import type { AvailabilityStatus, ProviderCapability, ProviderDescriptor, ProviderFamily } from "./types.js";
export interface EligibilityContext { capability:ProviderCapability; mediaType:string; languages:readonly string[]; mode:string; requireProductionAuthorization:boolean; availability:Readonly<Record<string,AvailabilityStatus>> }
const clone=<T>(value:T):Readonly<T>=>Object.freeze(structuredClone(value));
export class ProviderRegistry { private readonly providers:readonly ProviderDescriptor[]; private readonly byId:ReadonlyMap<string,ProviderDescriptor>;
 constructor(descriptors:readonly ProviderDescriptor[]){const sorted=[...descriptors].sort((a,b)=>a.providerId.localeCompare(b.providerId));const ids=new Set<string>();for(const d of sorted){assertProviderDescriptor(d);if(ids.has(d.providerId))throw new Error(`duplicate providerId: ${d.providerId}`);ids.add(d.providerId)}this.providers=Object.freeze(sorted.map(d=>clone(d) as ProviderDescriptor));this.byId=new Map(this.providers.map(d=>[d.providerId,d]));}
 listProviders(){return this.providers} getProvider(id:string){return this.byId.get(id)} listProvidersForFamily(f:ProviderFamily){return Object.freeze(this.providers.filter(p=>p.providerFamily===f))} listProvidersForCapability(c:ProviderCapability){return Object.freeze(this.providers.filter(p=>p.supportedCapabilities.some(s=>s.capability===c&&["SUPPORTED","PARTIALLY_SUPPORTED"].includes(s.supportStatus))))}
 evaluateProviderEligibility(id:string,c:EligibilityContext){const p=this.byId.get(id);const reasons:string[]=[];if(!p)return{providerId:id,eligible:false,reasons:["PROVIDER_NOT_FOUND"]} as const;if(!p.selectable)reasons.push("PROVIDER_NOT_SELECTABLE");if(c.requireProductionAuthorization&&p.productionAuthorization!=="AUTHORIZED")reasons.push("PRODUCTION_NOT_AUTHORIZED");const support=p.supportedCapabilities.find(s=>s.capability===c.capability);if(!support||!["SUPPORTED","PARTIALLY_SUPPORTED"].includes(support.supportStatus))reasons.push("CAPABILITY_UNSUPPORTED");if(!p.supportedMediaTypes.includes(c.mediaType))reasons.push("MEDIA_TYPE_UNSUPPORTED");if(c.languages.some(language=>!p.supportedLanguages.includes(language)))reasons.push("LANGUAGE_UNSUPPORTED");const availability=c.availability[id]??"NOT_CHECKED";if(availability!=="AVAILABLE"&&availability!=="NOT_CHECKED")reasons.push(`RUNTIME_${availability}`);return{providerId:id,eligible:reasons.length===0,reasons:Object.freeze(reasons)} as const;}
}
