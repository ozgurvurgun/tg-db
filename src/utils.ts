import { Document, QueryFilter } from './types';

export function encodeDocument(doc: Document, prefix: string = "TDB:"): string {
  const json = JSON.stringify(doc);
  return `${prefix}${json}`;
}

export function decodeDocument(messageText: string, prefix: string = "TDB:"): Document | null {
  if (!messageText.startsWith(prefix)) {
    return null;
  }
  
  try {
    const json = messageText.substring(prefix.length);
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

export function matchesFilter(doc: Document, filter: QueryFilter): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (key === '_id' && doc._id !== value) {
      return false;
    }
    
    const docValue = getNestedValue(doc, key);
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!matchesOperators(docValue, value)) {
        return false;
      }
    } else if (Array.isArray(value)) {
      if (!value.includes(docValue)) {
        return false;
      }
    } else {
      if (docValue !== value) {
        return false;
      }
    }
  }
  
  return true;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function matchesOperators(docValue: any, operators: any): boolean {
  for (const [op, opValue] of Object.entries(operators)) {
    switch (op) {
      case '$gt':
        if (!(docValue > (opValue as any))) return false;
        break;
      case '$gte':
        if (!(docValue >= (opValue as any))) return false;
        break;
      case '$lt':
        if (!(docValue < (opValue as any))) return false;
        break;
      case '$lte':
        if (!(docValue <= (opValue as any))) return false;
        break;
      case '$ne':
        if (docValue === (opValue as any)) return false;
        break;
      case '$in':
        if (!Array.isArray(opValue) || !opValue.includes(docValue)) return false;
        break;
      case '$nin':
        if (Array.isArray(opValue) && opValue.includes(docValue)) return false;
        break;
      case '$regex':
        if (typeof docValue !== 'string') return false;
        const regex = new RegExp(opValue as string);
        if (!regex.test(docValue)) return false;
        break;
      case '$exists':
        const exists = docValue !== undefined && docValue !== null;
        if (opValue !== exists) return false;
        break;
      default:
        break;
    }
  }
  return true;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}
