/*************************************************************
 *
 *  MathJax/jax/input/TeX/StackItem.ts
 *
 *  Implements the TeX InputJax that reads mathematics in
 *  TeX and LaTeX format and converts it to the MML ElementJax
 *  internal format.
 *
 *  ---------------------------------------------------------------------
 *
 *  Copyright (c) 2009-2017 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


/**
 * @fileoverview Stack items hold information on the TexParser stack.
 *
 * @author v.sorge@mathjax.org (Volker Sorge)
 */

import MapHandler from './MapHandler.js';
import {CharacterMap} from './SymbolMap.js';
import {Entities} from '../../util/Entities.js';
import {MmlNode, TextNode, TEXCLASS} from '../../core/MmlTree/MmlNode.js';
import {MmlMsubsup} from '../../core/MmlTree/MmlNodes/msubsup.js';
import {TexConstant} from './TexConstants.js';
import TexError from './TexError.js';
// import {TexError} from './TexError.js';
import {ParserUtil} from './ParserUtil.js';
import {TreeHelper} from './TreeHelper.js';
import {Property, PropertyList} from '../../core/Tree/Node.js';
import StackItemFactory from './StackItemFactory.js';

// Stack item classes for the parser stack.

// Future Interface:
// readonly get type,
// public: push, pop, checkitem,
// protected: isOpen
//
// BaseItem is the abstract class.
//
// protected this.data .
//
// Errors should go into a proper Error Object.

// TODO: Marry these eventually with Property and PropertyList?
export type EnvProp = string | number | boolean;

export type EnvList = {[key: string]: EnvProp};

// This is the type for all fields that used to be set with With.
export type Prop = string | number | boolean | MmlNode | PropList;

export type PropList = {[key: string]: Prop};

export type ErrorMsg = string[];

export type ErrorList = {[key: string]: ErrorMsg};

export type CheckType = boolean | MmlItem | (MmlNode | StackItem)[];

export interface StackItem {

  kind: string;
  isClose: boolean;
  isOpen: boolean;
  isFinal: boolean;
  data: MmlNode[];
  global: EnvList;
  env: EnvList;

  checkItem(item: StackItem): CheckType;

  /**
   * Returns nodes on the stack item's node stack as an Mml node. I.e., in case
   * the item contains more than one node, it creates an mrow.
   * @param {boolean=} inferred If set the mrow will be an inferred mrow.
   * @param {boolean=} forceRow If set an mrow will be created, regardless of
   *     how many nodes the item contains.
   * @return {MmlNode} The topmost Mml node.
   */
  toMml(inferred?: boolean, forceRow?: boolean): MmlNode;

  /**
   * @return {MmlNode} The topmost node on the item's node stack.
   */
  Pop(): MmlNode | void;

  /**
   * Pushes new nodes onto the items node stack.
   * @param {MmlNode[]} ...nodes A list of nodes.
   */
  Push(...nodes: MmlNode[]): void;

  /**
   * Get the top n elements on the node stack without removing them.
   * @param {number=} n Number of elements that should be returned.
   * @return {MmlNode[]} List of nodes on top of stack.
   */
  Top(n?: number): MmlNode[];

  /**
   * Tests if item is of the given type.
   * @param {string} kind The type.
   * @return {boolean} True if item is of that type.
   */
  isKind(kind: string): boolean;

  getProperty(key: string): Prop;
  setProperty(key: string, value: Prop): void;

  getName(): string;
}

export interface StackItemClass {
  new (factory: StackItemFactory, ...nodes: MmlNode[]): StackItem;
}

export class BaseItem implements StackItem {

  private _env: EnvList;

  private _properties: PropList = {};

  protected errors: {[key: string]: string[]} = {
    endError:   ['ExtraOpenMissingClose',
                 'Extra open brace or missing close brace'],
    closeError: ['ExtraCloseMissingOpen',
                 'Extra close brace or missing open brace'],
    rightError: ['MissingLeftExtraRight',
                 'Missing \\left or extra \\right']
  };

  public global: EnvList = {};

  public data: MmlNode[] = [];

  constructor(private _factory: StackItemFactory, ...nodes: MmlNode[]) {
    if (this.isOpen) {
      this._env = {};
    }
    this.Push.apply(this, nodes);
  }

  public get factory() {
    return this._factory;
  }

  /**
   * @return {string} The type of the stack item.
   */
  public get kind() {
    return 'base';
  }

  get env() {
    return this._env;
  }

  set env(value) {
    this._env = value;
  }

  getProperty(key: string): Prop {
    return this._properties[key];
  }

  setProperty(key: string, value: Prop) {
    this._properties[key] = value;
  }


  /**
   * @return {boolean} True if item is an opening entity, i.e., it expects a
   *     closing counterpart on the stack later.
   */
  get isOpen() {
    return false;
  }

  /**
   * @return {boolean} True if item is an closing entity, i.e., it needs an
   *     opening counterpart already on the stack.
   */
  get isClose() {
    return false;
  }


  /**
   * @return {boolean} True if item is final, i.e., it contains one or multiple
   *      finished parsed nodes.
   */
  get isFinal() {
    return false;
  }


  /**
   * @override
   */
  public Push(...nodes: MmlNode[]) {
    TreeHelper.printMethod('StackItem Push arguments: ' + this.data + ' arguments: ');
    this.data.push.apply(this.data, nodes);
  }


  /**
   * @override
   */
  public Pop(): MmlNode | void {
    return this.data.pop();
  }


  /**
   * @override
   */
  public Top(n?: number): MmlNode[] {
    if (n == null) {
      n = 1;
    }
    return this.data.slice(0, n);
  }


  /**
   * @override
   */
  public isKind(kind: string) {
    return kind === this.kind;
  }


  /**
   * @override
   */
  public toMml(inferred?: boolean, forceRow?: boolean) {
    TreeHelper.printMethod('toMml');
    if (inferred == null) {
      inferred = true;
    }
    if (this.data.length === 1 && !forceRow) {
      TreeHelper.printSimple('End 1');
      return this.data[0];
    }
    // @test Two Identifiers
    return TreeHelper.createNode(inferred ? 'inferredMrow' : 'mrow', this.data, {});
    // VS: OLD
    // var node = MML.mrow.apply(MML,this.data).With((inferred ? {inferred: true}: {}));
  }


  /**
   * @override
   */
  public checkItem(item: StackItem): CheckType {
    TreeHelper.printMethod('Checkitem base for ' + item.kind + ' with ' + item);
    if (item.isKind('over') && this.isOpen) {
      item.setProperty('num', this.toMml(false));
      this.data = [];
    }
    if (item.isKind('cell') && this.isOpen) {
      if (item.getProperty('linebreak')) {
        return false;
      }
      // TODO: Test what symbol really does!
      //throw new TexError(['Misplaced', 'Misplaced %1', item.getProperty('name').symbol]);
      // @test Ampersand-error
      throw new TexError(['Misplaced', 'Misplaced %1', item.getName()]);
    }
    if (item.isClose && this.errors[item.kind + 'Error']) {
      throw new TexError(this.errors[item.kind + 'Error']);
    }
    if (!item.isFinal) {
      return true;
    }
    this.Push(item.data[0]);
    return false;
  }


  // TODO: This needs proper changing once we get rid of legacy compatibility!
  With(def: PropList) {
    for (let id in def) {
      if (def.hasOwnProperty(id)) {
        this.setProperty(id, def[id]);
      }
    }
    return this;
  }



  /**
   * Convenience method for returning the string property "name".
   * @return {string} The value for the name property.
   */
  public getName() {
    return this.getProperty('name') as string;
  }


  /**
   * @override
   */
  public toString() {
    return this.kind + '[' + this.data.join('; ') + ']';
  }

}

export class StartItem extends BaseItem {

  // TODO: Sort out this type!
  constructor(factory: StackItemFactory, ...global: any[]) {
    super(factory);
    this.global = global[0] as EnvList;
  }


  /**
   * @override
   */
  public get kind() {
    return 'start';
  }


  /**
   * @override
   */
  get isOpen() {
    return true;
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem start');
    if (item.isKind('stop')) {
      return this.factory.create('mml', this.toMml());
    }
    return super.checkItem(item);
  }
}

export class StopItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'stop';
  }


  /**
   * @override
   */
  get isClose() {
    return true;
  }

}

export class OpenItem extends BaseItem {

  constructor(factory: StackItemFactory) {
    super(factory);
    this.errors['stopError'] = ['ExtraOpenMissingClose',
                                'Extra open brace or missing close brace'];
  }

  /**
   * @override
   */
  public get kind() {
    return 'open';
  }


  /**
   * @override
   */
  get isOpen() {
    return true;
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem open');
    if (item.isKind('close')) {
      let mml = this.toMml();
      // @test PrimeSup
      // TODO: Move that into toMml?
      mml = TreeHelper.cleanSubSup(mml);
      const node = TreeHelper.createNode('TeXAtom', [mml], {});
      // VS: OLD
      // var node = MML.TeXAtom(mml);
      return this.factory.create('mml', node); // TeXAtom make it an ORD to prevent spacing
                                // (FIXME: should be another way)
    }
    return super.checkItem(item);
  }
}


export class CloseItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'close';
  }


  /**
   * @override
   */
  get isClose() {
    return true;
  }

}


export class PrimeItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'prime';
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem prime');
    if (!TreeHelper.isType(this.data[0], 'msubsup')) {
      // @test Prime, Double Prime
      const node = TreeHelper.createNode('msup', [this.data[0], this.data[1]], {});
      // VS: OLD
      // var node = MML.msup(this.data[0],this.data[1]);
      return [node, item];
    }
    TreeHelper.setData(this.data[0], (this.data[0] as MmlMsubsup).sup, this.data[1]);
    return [this.data[0], item];
  }
}

export class SubsupItem extends BaseItem {

  constructor(factory: StackItemFactory, ...nodes: MmlNode[]) {
    super(factory, ...nodes);
    this.errors['stopError'] = ['MissingScript',
                               'Missing superscript or subscript argument'];
    this.errors['supError'] =  ['MissingOpenForSup',
                                'Missing open brace for superscript'];
    this.errors['subError'] =  ['MissingOpenForSub',
                                'Missing open brace for subscript'];
  }

  /**
   * @override
   */
  public get kind() {
    return 'subsup';
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem subsup');
    if (item.isKind('open') || item.isKind('left')) {
      return true;
    }
    if (item.isKind('mml')) {
      if (this.getProperty('primes')) {
        if (this.getProperty('position') !== 2) {
          // @test Prime on Sub
          TreeHelper.setData(this.data[0], 2, this.getProperty('primes') as MmlNode);
        } else {
          // @test Prime on Prime
          TreeHelper.setProperties(this.getProperty('primes') as MmlNode, {variantForm: true});
          const node = TreeHelper.createNode('mrow', [this.getProperty('primes') as MmlNode, item.data[0]], {});
          // VS: OLD
          // var node = MML.mrow(this.primes, item.data[0]);
          item.data[0] = node;
        }
      }
      TreeHelper.setData(this.data[0], this.getProperty('position') as number, item.data[0]);
      if (this.getProperty('movesupsub') != null) {
        // @test Limits Subsup (currently does not work! Check again!)
        TreeHelper.setProperties(this.data[0], {movesupsub: this.getProperty('movesupsub')} as PropertyList);
      }
      const result = this.factory.create('mml', this.data[0]);
      return result;
    }
    if (super.checkItem(item)) {
      // @test Brace Superscript Error
      throw new TexError(this.errors[['', 'subError', 'supError']
                                     [this.getProperty('position') as number]]);
    }
  }

}

export class OverItem extends BaseItem {

  constructor(factory: StackItemFactory) {
    super(factory);
    this.setProperty('name', '\\over');
  }

  /**
   * @override
   */
  public get kind() {
    return 'over';
  }


  /**
   * @override
   */
  get isClose() {
    return true;
  }


  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem over');
    if (item.isKind('over')) {
      // @test Double Over
      throw new TexError(['AmbiguousUseOf', 'Ambiguous use of %1', item.getName()]);
    }
    if (item.isClose) {
      // @test Over
      let mml = TreeHelper.createNode('mfrac',
                                      [this.getProperty('num') as MmlNode, this.toMml(false)], {});
      // VS: OLD
      // var mml = MML.mfrac(this.num,this.toMml(false));
      if (this.getProperty('thickness') != null) {
        // @test Choose, Above, Above with Delims
        TreeHelper.setAttribute(mml, 'linethickness', this.getProperty('thickness') as string);
      }
      if (this.getProperty('open') || this.getProperty('close')) {
        // @test Choose
        TreeHelper.setProperties(mml, {'withDelims': true});
        mml = ParserUtil.fixedFence(this.getProperty('open') as string, mml,
                                    this.getProperty('close') as string);
      }
      return [this.factory.create('mml', mml), item];
    }
    return super.checkItem(item);
  }


  toString() {return 'over[' + this.getProperty('num') + ' / ' + this.data.join('; ') + ']';}

}

export class LeftItem extends BaseItem {

  constructor(factory: StackItemFactory) {
    super(factory);
    this.setProperty('delim', '('),
    this.errors['stopError'] = ['ExtraLeftMissingRight',
                                'Extra \\left or missing \\right'];
  }

  /**
   * @override
   */
  public get kind() {
    return 'left';
  }


  /**
   * @override
   */
  get isOpen() {
    return true;
  }


  checkItem(item: StackItem) {
    // @test Missing Right
    TreeHelper.printMethod('Checkitem left');
    if (item.isKind('right')) {
      return this.factory.create('mml', 
        ParserUtil.fenced(this.getProperty('delim') as string, this.toMml(),
                          item.getProperty('delim') as string));
    }
    return super.checkItem(item);
  }

}

export class RightItem extends BaseItem {

  constructor(factory: StackItemFactory) {
    super(factory);
    this.setProperty('delim', ')');
  }

  /**
   * @override
   */
  public get kind() {
    return 'right';
  }


  /**
   * @override
   */
  get isClose() {
    return true;
  }

}

export class BeginItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'begin';
  }


  /**
   * @override
   */
  get isOpen() {
    return true;
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem begin');
    if (item.isKind('end')) {
      if (item.getName() !== this.getName()) {
        throw new TexError(['EnvBadEnd', '\\begin{%1} ended with \\end{%2}',
                            this.getName(), item.getName()]);
      }
      if (!this.getProperty('end')) {
        return this.factory.create('mml', this.toMml());
      }
      // TODO: This case currently does not work!
      //
      //       The problem: It needs to call a particular Parse Method. It is
      //       only used in equation(*) anyway and should therefore probably
      //       handled in a special case.
      // return this.parse[this.end].call(this.parse, this, this.data);
      return;
    }
    if (item.isKind('stop')) {
      throw new TexError(['EnvMissingEnd', 'Missing \\end{%1}', this.getName()]);
    }
    return super.checkItem(item);
  }

}

export class EndItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'end';
  }


  /**
   * @override
   */
  get isClose() {
    return true;
  }

}

export class StyleItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'style';
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem style');
    if (!item.isClose) {
      return super.checkItem(item);
    }
    // @test Style
    const mml = TreeHelper.createNode('mstyle', this.data, this.getProperty('styles'));
    // VS: OLD
    // var mml = MML.mstyle.apply(MML,this.data).With(this.styles);
    return [this.factory.create('mml', mml), item];
  }

}

export class PositionItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'position';
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem position');
    if (item.isClose) {
      throw new TexError(['MissingBoxFor', 'Missing box for %1', this.getName()]);
    }
    if (item.isFinal) {
      let mml = item.toMml();
      switch (this.getProperty('move')) {
      case 'vertical':
        // @test Raise, Lower
        mml = TreeHelper.createNode('mpadded', [mml],
                                    {height: this.getProperty('dh'), depth: this.getProperty('dd'),
                                     voffset: this.getProperty('dh')});
        // VS: OLD
        // mml = MML.mpadded(mml).With({height: this.dh, depth: this.dd, voffset: this.dh});
        return [this.factory.create('mml', mml)];
      case 'horizontal':
        return [this.factory.create('mml', this.getProperty('left') as MmlNode), item,
                this.factory.create('mml', this.getProperty('right') as MmlNode)];
      }
    }
    return super.checkItem(item);
  }
}

export class ArrayItem extends BaseItem {

  public table: MmlNode[] = [];
  public row: MmlNode[] = [];
  public frame: string[] = [];
  public hfill: number[] = [];
  public copyEnv = false;
  public arraydef: {[key: string]: string|number|boolean}= {};
  public dashed: boolean = false;

  /**
   * @override
   */
  public get kind() {
    return 'array';
  }

  
  /**
   * @override
   */
  get isOpen() {
    return true;
  }


  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem array');
    // @test Array Single
    if (item.isClose && !item.isKind('over')) {
      // @test Array Single
      if (item.getProperty('isEntry')) {
        // @test Array dashed column, Array solid column
        this.EndEntry();
        this.clearEnv();
        return false;
      }
      if (item.getProperty('isCR')) {
        // @test Enclosed bottom
        this.EndEntry();
        this.EndRow();
        this.clearEnv();
        return false;
      }
      this.EndTable();
      this.clearEnv();
      const scriptlevel = this.arraydef['scriptlevel'];
      delete this.arraydef['scriptlevel'];
      let mml = TreeHelper.createNode('mtable', this.table, this.arraydef);
      // VS: OLD
      // var mml = MML.mtable.apply(MML,this.table).With(this.arraydef);
      if (this.frame.length === 4) {
        // @test Enclosed frame solid, Enclosed frame dashed
        TreeHelper.setAttribute(mml, 'frame', this.dashed ? 'dashed' : 'solid');
      } else if (this.frame.length) {
        // @test Enclosed left right
        // mml.hasFrame = true;
        if (this.arraydef['rowlines']) {
          // @test Enclosed dashed row, Enclosed solid row,
          this.arraydef['rowlines'] =
            (this.arraydef['rowlines'] as string).replace(/none( none) + $/, 'none');
        }
        // @test Enclosed left right
        mml = TreeHelper.createNode('menclose', [mml],
                             {notation: this.frame.join(' '), isFrame: true});
        // VS: OLD
        // mml = MML.menclose(mml).With({notation: this.frame.join(' '), isFrame: true});
        if ((this.arraydef['columnlines'] || 'none') !== 'none' ||
            (this.arraydef['rowlines'] || 'none') !== 'none') {
          // @test Enclosed dashed row, Enclosed solid row
          // @test Enclosed dashed column, Enclosed solid column
          // HTML-CSS jax implements this
          TreeHelper.setAttribute(mml, 'padding', 0);
        }
      }
      if (scriptlevel) {
        // @test Subarray, Small Matrix
        mml = TreeHelper.createNode('mstyle', [mml], {scriptlevel: scriptlevel});
        // VS: OLD
        // mml = MML.mstyle(mml).With({scriptlevel: scriptlevel})}
      }
      if (this.getProperty('open') || this.getProperty('close')) {
        // @test Cross Product Formula
        mml = ParserUtil.fenced(this.getProperty('open') as string, mml,
                                this.getProperty('close') as string);
      }
      let newItem = this.factory.create('mml', mml);
      if (this.getProperty('requireClose')) {
        // @test: Label
        if (item.isKind('close')) {
          // @test: Label
          return newItem;
        }
        throw new TexError(['MissingCloseBrace', 'Missing close brace']);
      }
      return [newItem, item];
    }
    return super.checkItem(item);
  }


  EndEntry() {
    // @test Array1, Array2
    const mtd = TreeHelper.createNode('mtd', this.data, {});
    // VS: OLD
    // var mtd = MML.mtd.apply(MML,this.data);
    if (this.hfill.length) {
      if (this.hfill[0] === 0) {
        TreeHelper.setAttribute(mtd, 'columnalign', 'right');
      }
      if (this.hfill[this.hfill.length - 1] === this.data.length) {
        TreeHelper.setAttribute(mtd, 'columnalign',
                                TreeHelper.getAttribute(mtd, 'columnalign') ? 'center' : 'left');
      }
    }
    this.row.push(mtd); this.data = []; this.hfill = [];
  }


  EndRow() {
    let node: MmlNode;
    if (this.getProperty('isNumbered') && this.row.length === 3) {
      this.row.unshift(this.row.pop());  // move equation number to first
                                         // position
      // @test Label
      node = TreeHelper.createNode('mlabeledtr', this.row, {});
      // VS: OLD
      // var node = MML.mlabeledtr.apply(MML,this.row);
    } else {
      // @test Array1, Array2
      node = TreeHelper.createNode('mtr', this.row, {});
      // VS: OLD
      // node = MML.mtr.apply(MML,this.row);
    }
    this.table.push(node);
    this.row = [];
  }


  EndTable() {
    if (this.data.length || this.row.length) {
      this.EndEntry();
      this.EndRow();
    }
    this.checkLines();
  }


  checkLines() {
    if (this.arraydef['rowlines']) {
      const lines = (this.arraydef['rowlines'] as string).split(/ /);
      if (lines.length === this.table.length) {
        this.frame.push('bottom'); lines.pop();
        this.arraydef['rowlines'] = lines.join(' ');
      } else if (lines.length < this.table.length - 1) {
        this.arraydef['rowlines'] += ' none';
      }
    }
    if (this.getProperty('rowspacing')) {
      const rows = (this.arraydef['rowspacing'] as string).split(/ /);
      while (rows.length < this.table.length) {
        rows.push(this.getProperty('rowspacing') + 'em');
      }
      this.arraydef['rowspacing'] = rows.join(' ');
    }
  }


  clearEnv() {
    for (let id in this.env) {
      if (this.env.hasOwnProperty(id)) {
        delete this.env[id];
      }
    }
  }
}


export class CellItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'cell';
  }


  /**
   * @override
   */
  get isClose() {
    return true;
  }
}


export class MmlItem extends BaseItem {

  /**
   * @override
   */
  public get isFinal() {
    return true;
  }

  /**
   * @override
   */
  public get kind() {
    return 'mml';
  }

}


export class FnItem extends BaseItem {

  constructor(factory: StackItemFactory, ...nodes: MmlNode[]) {
    super(factory, ...nodes);
  }

  /**
   * @override
   */
  public get kind() {
    return 'fn';
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem fn');
    const top = this.data[0];
    if (top) {
      if (item.isOpen) {
        return true;
      }
      if (!item.isKind('fn')) {
        TreeHelper.printSimple('case 3');
        let mml = item.data[0];
        if (!item.isKind('mml') || !mml) {
          TreeHelper.printSimple('case 4');
          return [top, item];
        }
        if (TreeHelper.isType(item.data[0], 'mspace')) {
          TreeHelper.untested(100);
          return [top, item];
        }
        if (TreeHelper.isEmbellished(mml)) {
          TreeHelper.printSimple('case 5');
          mml = TreeHelper.getCoreMO(mml);
        }
        // TODO: Look this up in the operator table either as
        //       infix/postfix/prefix.
        if ([0, 0, 1, 1, 0, 1, 1, 0, 0, 0][TreeHelper.getTexClass(mml)]) {
          return [top, item];
        }
      }
      // @test Named Function
      const text = TreeHelper.createText(Entities.ENTITIES.ApplyFunction);
      const node = TreeHelper.createNode('mo', [], {texClass: TEXCLASS.NONE}, text);
      // VS: OLD
      // var node = MML.mo(MML.entity('#x2061')).With({texClass:MML.TEXCLASS.NONE});
      return [top, node, item];
    }
    return super.checkItem.apply(this, arguments);
  }
}

export class NotItem extends BaseItem {

  private remap = MapHandler.getInstance().getMap('not_remap') as CharacterMap;

  /**
   * @override
   */
  public get kind() {
    return 'not';
  }

  // TODO: There is a lot of recasting that should go away!
  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem not');
    let mml: TextNode | MmlNode;
    let c: string;
    let textNode: TextNode;
    if (item.isKind('open') || item.isKind('left')) {
      return true;
    }
    if (item.isKind('mml') &&
        (TreeHelper.isType(item.data[0], 'mo') || TreeHelper.isType(item.data[0], 'mi') ||
         TreeHelper.isType(item.data[0], 'mtext'))) {
      mml = item.data[0] as TextNode;
      TreeHelper.printJSON(mml);
      c = TreeHelper.getText(mml as TextNode);
      if (c.length === 1 && !TreeHelper.getProperty(mml, 'movesupsub') &&
          TreeHelper.getChildren(mml).length === 1) {
        if (this.remap.contains(c)) {
          // @test Negation Simple, Negation Complex
          textNode = TreeHelper.createText(this.remap.lookup(c).char);
          TreeHelper.setData(mml, 0, textNode);
          // VS: OLD
          // mml.SetData(0, MML.chars(this.remap.lookup(c).char));
        } else {
          // @test Negation Explicit
          textNode = TreeHelper.createText('\u0338');
          TreeHelper.appendChildren(mml, [textNode]);
          // VS: OLD
          // mml.Append(MML.chars('\u0338'));
        }
        return item as MmlItem;
      }
    }
    //  \mathrel{\rlap{\notChar}}
    // @test Negation Large
    textNode = TreeHelper.createText('\u29F8');
    const mtextNode = TreeHelper.createNode('mtext', [], {}, textNode);
    const paddedNode = TreeHelper.createNode('mpadded', [mtextNode], {width: 0});
    mml = TreeHelper.createNode('TeXAtom', [paddedNode], {texClass: TEXCLASS.REL}) as MmlNode;
    // VS: OLD
    // mml = MML.mpadded(MML.mtext('\u29F8')).With({width:0});
    // mml = MML.TeXAtom(mml).With({texClass:MML.TEXCLASS.REL});
    return [mml, item];
  }
}


export class DotsItem extends BaseItem {

  /**
   * @override
   */
  public get kind() {
    return 'dots';
  }

  checkItem(item: StackItem) {
    TreeHelper.printMethod('Checkitem dots');
    if (item.isKind('open') || item.isKind('left')) {
      return true;
    }
    let dots = this.getProperty('ldots') as MmlNode;
    // @test Operator Dots
    if (item.isKind('mml') && TreeHelper.isEmbellished(item.data[0])) {
      // TODO: Lookup in Operator Table.
      const tclass = TreeHelper.getTexClass(TreeHelper.getCoreMO(item.data[0]));
      if (tclass === TEXCLASS.BIN || tclass === TEXCLASS.REL) {
        dots = this.getProperty('cdots') as MmlNode;
      }
    }
    return [dots, item];
  }
}
