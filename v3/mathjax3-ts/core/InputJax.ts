import {MathItem, ProtoItem} from './MathItem.js';
import {MmlNode} from './MmlTree/MmlNode.js';
import {UserOptions, DefaultOptions, OptionList} from '../util/Options.js';
import {FunctionList} from '../util/FunctionList.js';

export interface InputJax {
    name: string;
    processStrings: boolean;
    options: OptionList;
    preFilters: FunctionList;
    postFilters: FunctionList;

    FindMath(node: Element | string[], options?: OptionList): ProtoItem[];
    Compile(math: MathItem): MmlNode;
}

export interface InputJaxClass {
    new(options?: OptionList): InputJax;
    NAME: string;
    OPTIONS: OptionList;
}

export abstract class AbstractInputJax implements InputJax {
    public static NAME: string = 'generic';
    public static OPTIONS: OptionList = {};

    public options: OptionList;
    public preFilters: FunctionList;
    public postFilters: FunctionList;

    constructor(options: OptionList = {}) {
        let CLASS = this.constructor as InputJaxClass;
        this.options = UserOptions(DefaultOptions({}, CLASS.OPTIONS), options);
        this.preFilters = new FunctionList();
        this.postFilters = new FunctionList();
    }

    get name() {
        return (this.constructor as InputJaxClass).NAME;
    }

    get processStrings() {
        return true;
    }

    FindMath(node: Element | string[], options: OptionList) {
        // should operate on an array of strings, but for now, use DOM node
        return [] as ProtoItem[];
    }

    Compile(math: MathItem) {
        return null as MmlNode;
    }

};
