// ==================================================================
// DIGITAL LOGIC SYNTHESIZER - FULL SCRIPT
// ==================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.add('active');
        });
    });

    // Truth Table Input Generator
    document.getElementById('btnGenerateTTInputs').addEventListener('click', () => {
        const varsStr = document.getElementById('inputVarsTT').value;
        const vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
        if (vars.length === 0 || vars.length > 6) {
            alert("Please enter between 1 and 6 valid variables (A-Z).");
            return;
        }
        
        let html = '<table><thead><tr>';
        vars.forEach(v => html += `<th>${v}</th>`);
        html += '<th>Output</th></tr></thead><tbody>';
        
        const rows = Math.pow(2, vars.length);
        for(let i=0; i<rows; i++) {
            html += '<tr>';
            for(let j=0; j<vars.length; j++) {
                let val = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
                html += `<td>${val}</td>`;
            }
            html += `<td><select id="tt-out-${i}"><option value="0">0</option><option value="1">1</option></select></td></tr>`;
        }
        html += '</tbody></table>';
        document.getElementById('ttInputContainer').innerHTML = html;
        document.getElementById('ttInputContainer').dataset.vars = vars.join(',');
    });

    // Main Synthesize Button
    document.getElementById('btnSynthesize').addEventListener('click', processInput);
});

function processInput() {
    const errorMsg = document.getElementById('errorMsg');
    const outputs = document.getElementById('outputs');
    errorMsg.innerText = '';
    outputs.style.display = 'none';

    try {
        const activeTab = document.querySelector('.tab.active').dataset.target;
        let vars = [];
        let tt = [];

        if (activeTab === 'tab-expr') {
            const expr = document.getElementById('inputExpr').value;
            if(!expr.trim()) throw new Error("Expression cannot be empty.");
            vars = [...new Set(expr.toUpperCase().match(/[A-Z]/g) || [])].sort();
            if(vars.length > 6) throw new Error("Maximum 6 variables supported.");
            if(vars.length === 0) throw new Error("No valid variables found.");
            
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                let inputVals = {};
                for (let j = 0; j < vars.length; j++) {
                    inputVals[vars[j]] = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
                }
                tt.push(evaluateExpression(expr, inputVals));
            }
        } 
        else if (activeTab === 'tab-minterms') {
            const varsStr = document.getElementById('inputVarsMin').value;
            vars = [...new Set(varsStr.toUpperCase().match(/[A-Z]/g) || [])].sort();
            if(vars.length === 0 || vars.length > 6) throw new Error("Enter 1-6 valid variables.");
            
            const mintermsStr = document.getElementById('inputMinterms').value;
            const minterms = mintermsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                tt.push(minterms.includes(i) ? 1 : 0);
            }
        }
        else if (activeTab === 'tab-tt') {
            const container = document.getElementById('ttInputContainer');
            if(!container.dataset.vars) throw new Error("Generate the Truth Table inputs first.");
            vars = container.dataset.vars.split(',');
            const rows = Math.pow(2, vars.length);
            for (let i = 0; i < rows; i++) {
                tt.push(parseInt(document.getElementById(`tt-out-${i}`).value));
            }
        }

        runSynthesis(vars, tt);
        outputs.style.display = 'block';

    } catch (e) {
        errorMsg.innerText = e.message;
    }
}

// ------------------------------------------------------------------
// Core Logic & Evaluation (Supports implicit AND, e.g. ABC -> A&B&C)
// ------------------------------------------------------------------

function evaluateExpression(expr, inputs) {
    let norm = expr.toUpperCase()
                   .replace(/\s+/g, '')
                   .replace(/AND/g, '&').replace(/OR/g, '|').replace(/NOT/g, '~')
                   .replace(/\*/g, '&').replace(/\+/g, '|')
                   .replace(/!/g, '~');
    
    // Inject implicit ANDs between adjacent variables/parentheses
    norm = norm.replace(/([A-Z\)])(?=[A-Z\(~])/g, '$1&');
    
    // Replace variables with their binary values
    Object.keys(inputs).forEach(v => {
        let regex = new RegExp(v, 'g');
        norm = norm.replace(regex, inputs[v]);
    });
    
    // Convert logic operators to JS evaluation operators
    let jsExpr = norm.replace(/&/g, '&&').replace(/\|/g, '||').replace(/~/g, '!');
    
    try {
        const fn = new Function(`return !!(${jsExpr});`);
        return fn() ? 1 : 0;
    } catch(e) {
        throw new Error("Invalid Boolean Expression.");
    }
}

// ------------------------------------------------------------------
// Quine-McCluskey Minimization
// ------------------------------------------------------------------

function quineMcCluskey(minterms, numVars) {
    if (minterms.length === 0) return [];
    if (minterms.length === Math.pow(2, numVars)) return ['1'];

    let groups = Array.from({length: numVars + 1}, () => []);
    
    minterms.forEach(m => {
        let bin = m.toString(2).padStart(numVars, '0');
        let ones = bin.split('1').length - 1;
        groups[ones].push({ bits: bin, minterms: [m], used: false });
    });

    let primeImplicants = [];
    let changed = true;

    while (changed) {
        changed = false;
        let nextGroups = Array.from({length: numVars + 1}, () => []);
        let newTermsMap = new Set();

        for (let i = 0; i < groups.length - 1; i++) {
            for (let t1 of groups[i]) {
                for (let t2 of groups[i+1]) {
                    let diffIdx = -1, diffs = 0;
                    for (let k = 0; k < numVars; k++) {
                        if (t1.bits[k] !== t2.bits[k]) { diffs++; diffIdx = k; }
                    }
                    if (diffs === 1) {
                        t1.used = true;
                        t2.used = true;
                        let newBits = t1.bits.substring(0, diffIdx) + '-' + t1.bits.substring(diffIdx+1);
                        if (!newTermsMap.has(newBits)) {
                            newTermsMap.add(newBits);
                            let combined = Array.from(new Set([...t1.minterms, ...t2.minterms])).sort((a,b)=>a-b);
                            nextGroups[i].push({ bits: newBits, minterms: combined, used: false });
                            changed = true;
                        }
                    }
                }
            }
        }
        for (let g of groups) {
            for (let t of g) {
                if (!t.used && !primeImplicants.some(pi => pi.bits === t.bits)) {
                    primeImplicants.push(t);
                }
            }
        }
        groups = nextGroups;
    }

    let uncovered = new Set(minterms);
    let essential = [];

    minterms.forEach(m => {
        let covers = primeImplicants.filter(pi => pi.minterms.includes(m));
        if (covers.length === 1) {
            let epi = covers[0];
            if (!essential.includes(epi)) {
                essential.push(epi);
                epi.minterms.forEach(cm => uncovered.delete(cm));
            }
        }
    });

    let solution = [...essential];
    while (uncovered.size > 0) {
        let bestPI = null, maxCover = 0;
        primeImplicants.forEach(pi => {
            if (solution.includes(pi)) return;
            let coverCount = pi.minterms.filter(m => uncovered.has(m)).length;
            if (coverCount > maxCover) { maxCover = coverCount; bestPI = pi; }
        });
        solution.push(bestPI);
        bestPI.minterms.forEach(m => uncovered.delete(m));
    }
    return solution.map(pi => pi.bits);
}

// ------------------------------------------------------------------
// Synthesis Pipeline
// ------------------------------------------------------------------

function runSynthesis(vars, tt) {
    const minterms1 = tt.map((v, i) => v === 1 ? i : -1).filter(i => i !== -1);
    const minterms0 = tt.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
    
    const qmSOP = quineMcCluskey(minterms1, vars.length);
    const qmPOS = quineMcCluskey(minterms0, vars.length); 
    
    const sopTerms = qmSOP.map(bits => bitsToLiterals(bits, vars, true));
    const posTerms = qmPOS.map(bits => bitsToLiterals(bits, vars, false));

    document.getElementById('outSOP').innerText = formatEquation(sopTerms, false);
    document.getElementById('outPOS').innerText = formatEquation(posTerms, true);
    
    renderTruthTable(vars, tt);

    // Build Strict 2-Input ASTs
    const astStandard = buildStandardAST(sopTerms);
    const astStandardPOS = buildPOSStandardAST(posTerms);
    
    // Convert logic to universal gates
    const astNAND = convertToNAND(astStandard);
    const astNOR = convertToNOR(astStandardPOS);

    // Verify Outputs
    const verified = verifyASTs(vars, tt, astStandard, astNAND, astNOR);
    const msgBox = document.getElementById('verificationMsg');
    if (verified) {
        msgBox.className = 'verification success';
        msgBox.innerText = '✓ Verification Passed: Simplified, NAND-only, and NOR-only circuits all perfectly match the original truth table.';
    } else {
        msgBox.className = 'verification fail';
        msgBox.innerText = '✗ Verification Failed: Circuit outputs do not match the original truth table.';
    }

    // Render SVGs
    document.getElementById('svgStandard').innerHTML = renderAST(astStandard);
    document.getElementById('svgNAND').innerHTML = renderAST(astNAND);
    document.getElementById('svgNOR').innerHTML = renderAST(astNOR);
}

function bitsToLiterals(bits, vars, isSOP) {
    if (bits === '1') return ['1'];
    let term = [];
    for (let i = 0; i < bits.length; i++) {
        if (bits[i] === '1') term.push(isSOP ? vars[i] : `~${vars[i]}`);
        else if (bits[i] === '0') term.push(isSOP ? `~${vars[i]}` : vars[i]);
    }
    return term;
}

function formatEquation(terms, isPOS) {
    if (terms.length === 0) return isPOS ? "1" : "0";
    if (terms[0][0] === '1') return isPOS ? "0" : "1";
    
    let outerJoin = isPOS ? '' : ' + ';
    let innerJoin = isPOS ? ' + ' : '';
    let strings = terms.map(t => {
        let inner = t.join(innerJoin);
        return isPOS ? `(${inner})` : inner;
    });
    return strings.join(outerJoin);
}

function renderTruthTable(vars, tt) {
    let html = '<table><thead><tr>';
    vars.forEach(v => html += `<th>${v}</th>`);
    html += '<th>Output</th></tr></thead><tbody>';
    
    for(let i=0; i<tt.length; i++) {
        html += '<tr>';
        for(let j=0; j<vars.length; j++) {
            let val = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
            html += `<td>${val}</td>`;
        }
        html += `<td class="${tt[i] ? 'tt-one' : 'tt-zero'}">${tt[i]}</td></tr>`;
    }
    html += '</tbody></table>';
    document.getElementById('ttOutputContainer').innerHTML = html;
}

// ------------------------------------------------------------------
// AST Construction (Strict 2-Input Cascading)
// ------------------------------------------------------------------

function buildStandardAST(sopTerms) {
    if (sopTerms.length === 0) return { type: 'CONST', value: 0 };
    if (sopTerms[0][0] === '1') return { type: 'CONST', value: 1 };

    let orNodes = sopTerms.map(term => {
        let andNodes = term.map(lit => {
            if (lit.startsWith('~')) return { type: 'NOT', children: [{ type: 'VAR', value: lit.substring(1) }] };
            return { type: 'VAR', value: lit };
        });
        if (andNodes.length === 0) return { type: 'CONST', value: 1 };
        return andNodes.reduce((acc, curr) => ({ type: 'AND', children: [acc, curr] }));
    });
    
    if (orNodes.length === 0) return { type: 'CONST', value: 0 };
    return orNodes.reduce((acc, curr) => ({ type: 'OR', children: [acc, curr] }));
}

function buildPOSStandardAST(posTerms) {
    if (posTerms.length === 0) return { type: 'CONST', value: 1 };
    if (posTerms[0][0] === '1') return { type: 'CONST', value: 0 };

    let andNodes = posTerms.map(term => {
        let orNodes = term.map(lit => {
            if (lit.startsWith('~')) return { type: 'NOT', children: [{ type: 'VAR', value: lit.substring(1) }] };
            return { type: 'VAR', value: lit };
        });
        return orNodes.reduce((acc, curr) => ({ type: 'OR', children: [acc, curr] }));
    });
    
    return andNodes.reduce((acc, curr) => ({ type: 'AND', children: [acc, curr] }));
}

// Deep Equality helper for canceling double negations safely
function astEquals(n1, n2) {
    if (n1 === n2) return true;
    if (!n1 || !n2 || n1.type !== n2.type || n1.value !== n2.value) return false;
    let len1 = n1.children ? n1.children.length : 0;
    let len2 = n2.children ? n2.children.length : 0;
    if (len1 !== len2) return false;
    if (len1 === 0) return true;
    for (let i = 0; i < len1; i++) {
        if (!astEquals(n1.children[i], n2.children[i])) return false;
    }
    return true;
}

// Universal Gate Conversion (Automatically cancels double negations)
function NOT_NAND(node) {
    if (node.type === 'NAND' && astEquals(node.children[0], node.children[1])) return node.children[0];
    return { type: 'NAND', children: [node, node] };
}
function convertToNAND(node) {
    if (node.type === 'VAR' || node.type === 'CONST') return node;
    if (node.type === 'NOT') return NOT_NAND(convertToNAND(node.children[0]));
    if (node.type === 'AND') return NOT_NAND({ type: 'NAND', children: [convertToNAND(node.children[0]), convertToNAND(node.children[1])] });
    if (node.type === 'OR') return { type: 'NAND', children: [NOT_NAND(convertToNAND(node.children[0])), NOT_NAND(convertToNAND(node.children[1]))] };
}

function NOT_NOR(node) {
    if (node.type === 'NOR' && astEquals(node.children[0], node.children[1])) return node.children[0];
    return { type: 'NOR', children: [node, node] };
}
function convertToNOR(node) {
    if (node.type === 'VAR' || node.type === 'CONST') return node;
    if (node.type === 'NOT') return NOT_NOR(convertToNOR(node.children[0]));
    if (node.type === 'AND') return { type: 'NOR', children: [NOT_NOR(convertToNOR(node.children[0])), NOT_NOR(convertToNOR(node.children[1]))] };
    if (node.type === 'OR') return NOT_NOR({ type: 'NOR', children: [convertToNOR(node.children[0]), convertToNOR(node.children[1])] });
}

function evaluateAST(node, inputs) {
    if (!node) return 0;
    if (node.type === 'CONST') return node.value;
    if (node.type === 'VAR') return inputs[node.value];
    if (node.type === 'NOT') return !evaluateAST(node.children[0], inputs);
    if (node.type === 'AND') return node.children.reduce((acc, c) => acc && evaluateAST(c, inputs), true);
    if (node.type === 'OR') return node.children.reduce((acc, c) => acc || evaluateAST(c, inputs), false);
    if (node.type === 'NAND') return !(node.children.reduce((acc, c) => acc && evaluateAST(c, inputs), true));
    if (node.type === 'NOR') return !(node.children.reduce((acc, c) => acc || evaluateAST(c, inputs), false));
}

function verifyASTs(vars, ttOriginal, astSOP, astNAND, astNOR) {
    for(let i=0; i<ttOriginal.length; i++) {
        let inputVals = {};
        for(let j=0; j<vars.length; j++) {
            inputVals[vars[j]] = (i & (1 << (vars.length - 1 - j))) ? 1 : 0;
        }
        let resSOP = evaluateAST(astSOP, inputVals) ? 1 : 0;
        let resNAND = evaluateAST(astNAND, inputVals) ? 1 : 0;
        let resNOR = evaluateAST(astNOR, inputVals) ? 1 : 0;
        if(resSOP !== ttOriginal[i] || resNAND !== ttOriginal[i] || resNOR !== ttOriginal[i]) return false;
    }
    return true;
}

// ------------------------------------------------------------------
// SVG Rendering Engine (V3 - Pure Tree Unfolding & Layout)
// ------------------------------------------------------------------

// CRITICAL FIX: This unfolds shared DAG references into a pure tree
// so the layout engine doesn't overwrite shared X/Y coordinates.
function cloneTree(node) {
    if (!node) return null;
    let clone = { type: node.type, value: node.value };
    if (node.children) {
        clone.children = node.children.map(c => cloneTree(c));
    }
    return clone;
}

function layoutNode(node) {
    if (node.type === 'VAR' || node.type === 'CONST') {
        node.w = 60; node.h = 40; return {w: 60, h: 40};
    }
    let totalH = 0; let maxW = 0;
    node.children.forEach((c) => {
        let dim = layoutNode(c);
        totalH += dim.h;
        maxW = Math.max(maxW, dim.w);
    });
    let gap = 20; 
    node.h = Math.max(totalH + (node.children.length - 1) * gap, 60);
    node.w = maxW + 120; 
    return {w: node.w, h: node.h};
}

function positionNode(node, x, y) {
    node.x = x; node.y = y;
    if (!node.children || node.children.length === 0) return;
    
    let totalH = node.children.reduce((sum, c) => sum + c.h, 0);
    let totalGap = (node.children.length - 1) * 20;
    let startY = y - (totalH + totalGap) / 2;
    
    node.children.forEach(c => {
        let childY = startY + c.h / 2;
        positionNode(c, x - 120, childY); 
        startY += c.h + 20;
    });
}

function getGateInX(type, x) {
    if (type === 'OR' || type === 'NOR') return x - 15; 
    return x - 20; 
}

function getGateOutX(type, x) {
    if (type === 'VAR' || type === 'CONST') return x + 20;
    if (type === 'NOT') return x + 13;
    if (type === 'AND' || type === 'OR') return x + 20;
    if (type === 'NAND' || type === 'NOR') return x + 28;
    return x;
}

function renderAST(originalNode) {
    // 1. Force the AST into a pure tree to fix rendering coordinate overlaps
    let node = cloneTree(originalNode);
    
    if(node.type === 'CONST') {
        return `<svg width="200" height="60"><text x="100" y="35" text-anchor="middle" font-family="sans-serif">Output is constant ${node.value}</text></svg>`;
    }
    
    // 2. Initial Layout Calculation
    layoutNode(node);
    positionNode(node, 0, 0); 

    // 3. Strict Bounding Box Calculation
    let bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    function calcBounds(n) {
        bounds.minX = Math.min(bounds.minX, n.x - 40);
        bounds.maxX = Math.max(bounds.maxX, n.x + 40);
        bounds.minY = Math.min(bounds.minY, n.y - 40);
        bounds.maxY = Math.max(bounds.maxY, n.y + 40);
        if(n.children) n.children.forEach(calcBounds);
    }
    calcBounds(node);

    // 4. Shift everything cleanly into positive coordinates
    let padX = 30; let padY = 30;
    let shiftX = -bounds.minX + padX;
    let shiftY = -bounds.minY + padY;
    
    function applyShift(n) {
        n.x += shiftX; n.y += shiftY;
        if(n.children) n.children.forEach(applyShift);
    }
    applyShift(node);

    let svgWidth = (bounds.maxX - bounds.minX) + (padX * 2) + 60; 
    let svgHeight = (bounds.maxY - bounds.minY) + (padY * 2);

    // 5. Render to SVG
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" style="max-width: 100%; height: auto;" xmlns="http://www.w3.org/2000/svg">`;
    svg += drawConnections(node);
    svg += drawNodes(node);
    
    let outPinX = getGateOutX(node.type, node.x);
    svg += `<path d="M ${outPinX},${node.y} L ${outPinX + 30},${node.y}" stroke="#0f172a" stroke-width="2" fill="none"/>`;
    svg += `<text x="${outPinX + 40}" y="${node.y + 5}" font-family="sans-serif" font-weight="bold" fill="#0f172a">Out</text>`;
    svg += `</svg>`;
    return svg;
}

function drawConnections(node) {
    if (!node.children) return "";
    let svg = "";
    let numChildren = node.children.length;

    node.children.forEach((c, idx) => {
        let outX = getGateOutX(c.type, c.x);
        let inX = getGateInX(node.type, node.x);

        let spread = Math.min(30, (numChildren - 1) * 15);
        let step = numChildren > 1 ? spread / (numChildren - 1) : 0;
        let inY = (node.y - spread / 2) + (idx * step);

        let midX = outX + (inX - outX) / 2;
        svg += `<path d="M ${outX},${c.y} H ${midX} V ${inY} H ${inX}" fill="none" stroke="#64748b" stroke-width="2"/>`;
        svg += drawConnections(c);
    });
    return svg;
}

function drawNodes(node) {
    let svg = "";
    if (node.children) {
        node.children.forEach(c => { svg += drawNodes(c); });
    }
    let nx = node.x, ny = node.y;
    
    if (node.type === 'VAR' || node.type === 'CONST') {
        svg += `<rect x="${nx-20}" y="${ny-15}" width="40" height="30" rx="4" fill="#f8fafc" stroke="#64748b" stroke-width="1.5"/>`;
        svg += `<text x="${nx}" y="${ny+5}" font-family="monospace" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="middle">${node.value}</text>`;
    } else if (node.type === 'AND') {
        svg += `<path d="M ${nx-20},${ny-20} L ${nx},${ny-20} A 20,20 0 0,1 ${nx},${ny+20} L ${nx-20},${ny+20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-5}" y="${ny+3}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">AND</text>`;
    } else if (node.type === 'OR') {
        svg += `<path d="M ${nx-20},${ny-20} Q ${nx},${ny} ${nx-20},${ny+20} Q ${nx+10},${ny+20} ${nx+20},${ny} Q ${nx+10},${ny-20} ${nx-20},${ny-20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx}" y="${ny+3}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">OR</text>`;
    } else if (node.type === 'NOT') {
        svg += `<path d="M ${nx-20},${ny-15} L ${nx+5},${ny} L ${nx-20},${ny+15} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+9}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
    } else if (node.type === 'NAND') {
        svg += `<path d="M ${nx-20},${ny-20} L ${nx},${ny-20} A 20,20 0 0,1 ${nx},${ny+20} L ${nx-20},${ny+20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+24}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-5}" y="${ny+3}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">NAND</text>`;
    } else if (node.type === 'NOR') {
        svg += `<path d="M ${nx-20},${ny-20} Q ${nx},${ny} ${nx-20},${ny+20} Q ${nx+10},${ny+20} ${nx+20},${ny} Q ${nx+10},${ny-20} ${nx-20},${ny-20} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+24}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx}" y="${ny+3}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">NOR</text>`;
    }
    return svg;
}
