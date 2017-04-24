//
//  Check if an object is an object literal (as opposed to an instance of a class)
//
const OBJECT = {}.constructor;
function isObject(obj: any) {
    return typeof obj === 'object' && obj !== null && obj.constructor === OBJECT;
}

//
// Generic list of options
//
export type OptionList = {[name: string]: any};

//
//  Used to append an array to an array in default options
//
export const APPEND = Symbol('Append to option array');

//
//  Get all keys and symbols from an object
//
export function Keys(def: OptionList) {
    if (!def) {
        return [];
    }
    return (Object.keys(def) as (string | symbol)[]).concat(Object.getOwnPropertySymbols(def));
}

//
//  Make a deep copy of an object
//
export function Copy(def: OptionList): OptionList {
    let props: OptionList = {};
    for (const key of Keys(def)) {
        let prop = Object.getOwnPropertyDescriptor(def, key);
        let value = prop.value;
        if (Array.isArray(value)) {
            prop.value = Insert([], value, false);
        } else if (isObject(value)) {
            prop.value = Copy(value);
        }
        if (prop.enumerable) props[key] = prop;
    }
    return Object.defineProperties({}, props);
}

//
//  Insert one object into another (with optional warnings about
//  keys that aren't in the original)
//
export function Insert(dst: OptionList, src: OptionList, warn: boolean = true) {
    for (let key of Keys(src)) {
        if (warn && dst[key] === undefined) {
            if (typeof key === 'symbol') {
                key = key.toString();
            }
            throw new Error("Invalid option '" + key + "' (no default value).");
        }
        let sval = src[key], dval = dst[key];
        if (isObject(sval) && dval !== null &&
            (typeof dval === 'object' || typeof dval === 'function')) {
            if (Array.isArray(dval) && Array.isArray(sval[APPEND]) && Keys(sval).length === 1) {
                dval.push(...(sval[APPEND]));
            } else {
                Insert(dval, sval, warn);
            }
        } else if (Array.isArray(sval)) {
            dst[key] = [];
            Insert(dst[key], sval, false);
        } else if (isObject(sval)) {
            dst[key] = Copy(sval);
        } else {
            dst[key] = sval;
        }
    }
    return dst;
}

//
//  Merge options without warnings (so we can add new default values into an
//  existing default list)
//
export function DefaultOptions(options: OptionList, ...defs: OptionList[]) {
    defs.forEach(def => Insert(options, def, false));
    return options;
}

//
//  Merge options with warnings about undefined ones (so we can merge
//  user options into the default list)
//
export function UserOptions(options: OptionList, ...defs: OptionList[]) {
    defs.forEach(def => Insert(options, def, true));
    return options;
}

//
//  Select a subset of options by key name
//
export function SelectOptions(options: OptionList, ...keys: string[]) {
    let subset: OptionList = {};
    for (const key of keys) {
        subset[key] = options[key];
    }
    return subset;
}

//
//  Select a subset of options by keys from an object
//
export function SelectOptionsFromKeys(options: OptionList, object: OptionList) {
    return SelectOptions(options, ...Object.keys(object));
}

//
//  Separate options into two sets: the ones having the same keys
//  as the second object, and the ones that don't.
//
export function SeparateOptions(options: OptionList, ...objects: OptionList[]) {
    let results: OptionList[] = [];
    for (const object of objects) {
        let exists: OptionList = {}, missing: OptionList = {};
        for (const key of Object.keys(options||{})) {
            (object[key] === undefined ? missing : exists)[key] = options[key];
        }
        results.push(exists);
        options = missing;
    }
    results.unshift(options);
    return results;
}
