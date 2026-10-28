#!/usr/bin/env node
/* Read-only TypeScript JSX probe. No source writes, eval, or transformations.
 * Returns the syntax-tree ranges of HistoryPage's own JSX render expressions.
 * Nested effects, callbacks and gameplay/async functions are never inspected. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {execFileSync} = require('node:child_process');
function loadTypeScript() {
  try { return createRequire(path.resolve('frontend/package.json'))('typescript'); }
  catch (_) {
    try { return require('typescript'); }
    catch (_) {
      const globalRoot = execFileSync('npm', ['root', '-g'], {encoding:'utf8'}).trim();
      return require(path.join(globalRoot, 'typescript'));
    }
  }
}
function inspect(src) {
  const ts = loadTypeScript();
  const sf = ts.createSourceFile('HistoryPage.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  if (sf.parseDiagnostics.length) throw new Error('HistoryPage.tsx has existing TSX syntax errors; refusing source patch');
  const components=[];
  for (const stmt of sf.statements) {
    if(ts.isFunctionDeclaration(stmt) && stmt.name?.text==='HistoryPage' && stmt.body) components.push(stmt.body);
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if(decl.name?.text==='HistoryPage' && decl.initializer &&
          (ts.isArrowFunction(decl.initializer)||ts.isFunctionExpression(decl.initializer)) && ts.isBlock(decl.initializer.body)) {
          components.push(decl.initializer.body);
        }
      }
    }
  }
  if(components.length !== 1) throw new Error('Expected exactly one named HistoryPage function with a block body; refusing');
  const spans=[]; let nonJsxReturn=false;
  function visit(n) {
    if (n!==components[0] && ts.isFunctionLike(n)) return;
    if(ts.isReturnStatement(n)) {
      if(!n.expression) {nonJsxReturn=true;return;}
      let expr=n.expression;
      while(ts.isParenthesizedExpression(expr)) expr=expr.expression;
      if(ts.isJsxElement(expr)||ts.isJsxFragment(expr)||ts.isJsxSelfClosingElement(expr)) {
        spans.push({start:expr.getStart(sf),end:expr.end});
      } else if(expr.kind!==ts.SyntaxKind.NullKeyword) nonJsxReturn=true;
      return;
    }
    ts.forEachChild(n,visit);
  }
  visit(components[0]);
  if(nonJsxReturn || spans.length!==1) {
    throw new Error('Unfamiliar HistoryPage render structure; no source changes made');
  }
  for(let i=0;i<spans.length;i++) {
    const {start,end}=spans[i];
    if(start>=end||start<0||end>src.length) throw new Error('Invalid TSX span');
    if(i&&start<spans[i-1].end) throw new Error('Overlapping render spans');
  }
  return {spans};
}
try {
  const src=fs.readFileSync(0,'utf8');
  process.stdout.write(JSON.stringify(inspect(src))+'\n');
} catch(err) { process.stderr.write('REFUSED: TSX structure probe: '+err.message+'\n');process.exitCode=2; }
