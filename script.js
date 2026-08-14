// Main Application Logic
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
            if(vars.length > 6) throw new Error("Maximum 6 variables supported to prevent browser freeze.");
            if(vars.length === 0) throw new Error("No valid variables found in expression.");
            
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
// Core Logic & Evaluation
// ------------------------------------------------------------------

function evaluateExpression(expr, inputs) {
    let norm = expr.toUpperCase()
                   .replace(/AND/g, '&').replace(/OR/g, '|').replace(/NOT/g, '~')
                   .replace(/\*/g, '&').replace(/\+/g, '|')
                   .replace(/!/g, '~').replace(/\s+/g, '');
    
    // Replace variables with their values
    Object.keys(inputs).forEach(v => {
        let regex = new RegExp(v, 'g');
        norm = norm.replace(regex, inputs[v]);
    });
    
    // Convert logic operators to JS operators
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
                    let diffIdx = -1;
                    let diffs = 0;
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

    // Find Essentials & Cover
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
        let bestPI = null;
        let maxCover = 0;
        primeImplicants.forEach(pi => {
            if (solution.includes(pi)) return;
            let coverCount = pi.minterms.filter(m => uncovered.has(m)).length;
            if (coverCount > maxCover) {
                maxCover = coverCount;
                bestPI = pi;
            }
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
    
    // Minimized Strings
    const qmSOP = quineMcCluskey(minterms1, vars.length);
    const qmPOS = quineMcCluskey(minterms0, vars.length); // QM on zeros gives NOT(E) in SOP
    
    const sopTerms = qmSOP.map(bits => bitsToLiterals(bits, vars, true));
    const posTerms = qmPOS.map(bits => bitsToLiterals(bits, vars, false)); // Inverted literals for DeMorgan

    document.getElementById('outSOP').innerText = formatEquation(sopTerms, ' + ', '');
    document.getElementById('outPOS').innerText = formatEquation(posTerms, '', '()');
    
    renderTruthTable(vars, tt);

    // Build ASTs
    const astStandard = buildSopAST(sopTerms);
    const astNAND = buildNandAST(sopTerms);
    const astNOR = buildNorAST(posTerms);

    // Verify Output
    const verified = verifyASTs(vars, tt, astStandard, astNAND, astNOR);
    const msgBox = document.getElementById('verificationMsg');
    if (verified) {
        msgBox.className = 'verification success';
        msgBox.innerText = '✓ Verification Passed: Simplified, NAND-only, and NOR-only circuits all produce outputs identical to the original truth table for every input combination.';
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

function formatEquation(terms, outerJoin, innerWrap) {
    if (terms.length === 0) return "0";
    if (terms[0][0] === '1') return "1";
    let strings = terms.map(t => {
        let inner = t.join(outerJoin === ' + ' ? '' : ' + ');
        return innerWrap ? `(${inner})` : inner;
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
// AST Construction
// ------------------------------------------------------------------

function buildSopAST(sopTerms) {
    if (sopTerms.length === 0) return { type: 'CONST', value: 0 };
    if (sopTerms[0][0] === '1') return { type: 'CONST', value: 1 };

    let orNode = { type: 'OR', children: [] };
    sopTerms.forEach(term => {
        let andNode = { type: 'AND', children: [] };
        term.forEach(lit => {
            if (lit.startsWith('~')) {
                andNode.children.push({ type: 'NOT', children: [{ type: 'VAR', value: lit.substring(1) }] });
            } else {
                andNode.children.push({ type: 'VAR', value: lit });
            }
        });
        if (andNode.children.length === 1) orNode.children.push(andNode.children[0]);
        else orNode.children.push(andNode);
    });
    if (orNode.children.length === 1) return orNode.children[0];
    return orNode;
}

function buildNandAST(sopTerms) {
    if (sopTerms.length === 0) return { type: 'CONST', value: 0 };
    if (sopTerms[0][0] === '1') return { type: 'CONST', value: 1 };
    
    let rootNode = { type: 'NAND', children: [] };
    sopTerms.forEach(term => {
        let termNand = { type: 'NAND', children: [] };
        term.forEach(lit => {
            if (lit.startsWith('~')) {
                let v = lit.substring(1);
                termNand.children.push({ type: 'NAND', children: [{type:'VAR', value:v}, {type:'VAR', value:v}] });
            } else {
                termNand.children.push({ type: 'VAR', value: lit });
            }
        });
        if (termNand.children.length === 1) {
            let single = termNand.children[0];
            rootNode.children.push({ type: 'NAND', children: [single, single] });
        } else {
            rootNode.children.push(termNand);
        }
    });
    if (rootNode.children.length === 1) {
        let singleTerm = rootNode.children[0];
        return { type: 'NAND', children: [singleTerm, singleTerm] }; 
    }
    return rootNode;
}

function buildNorAST(posTerms) {
    if (posTerms.length === 0) return { type: 'CONST', value: 1 };
    if (posTerms[0][0] === '1') return { type: 'CONST', value: 0 }; // Since terms are inverted
    
    let rootNode = { type: 'NOR', children: [] };
    posTerms.forEach(term => {
        let termNor = { type: 'NOR', children: [] };
        term.forEach(lit => {
            if (lit.startsWith('~')) {
                let v = lit.substring(1);
                termNor.children.push({ type: 'NOR', children: [{type:'VAR', value:v}, {type:'VAR', value:v}] });
            } else {
                termNor.children.push({ type: 'VAR', value: lit });
            }
        });
        if (termNor.children.length === 1) {
            let single = termNor.children[0];
            rootNode.children.push({ type: 'NOR', children: [single, single] });
        } else {
            rootNode.children.push(termNor);
        }
    });
    if (rootNode.children.length === 1) {
        let singleTerm = rootNode.children[0];
        return { type: 'NOR', children: [singleTerm, singleTerm] };
    }
    return rootNode;
}

// ------------------------------------------------------------------
// AST Evaluation (Verification)
// ------------------------------------------------------------------

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

        if(resSOP !== ttOriginal[i] || resNAND !== ttOriginal[i] || resNOR !== ttOriginal[i]) {
            console.error("Verification failed at minterm " + i);
            return false;
        }
    }
    return true;
}
// ------------------------------------------------------------------
// SVG Rendering Engine (Updated with proper margins & pin alignment)
// ------------------------------------------------------------------

function getTreeDepth(node) {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getTreeDepth));
}

function layoutNode(node) {
    if (node.type === 'VAR' || node.type === 'CONST') {
        node.w = 50; 
        node.h = 40; 
        return { w: 50, h: 40 };
    }
    let totalH = 0;
    let maxW = 0;
    node.children.forEach((c) => {
        let dim = layoutNode(c);
        totalH += dim.h;
        maxW = Math.max(maxW, dim.w);
    });
    let gap = 25;
    node.h = Math.max(totalH + (node.children.length - 1) * gap, 70);
    node.w = maxW + 120;
    return { w: node.w, h: node.h };
}

function positionNode(node, x, y) {
    node.x = x; 
    node.y = y;
    if (!node.children || node.children.length === 0) return;
    
    let totalChildrenHeight = node.children.reduce((sum, c) => sum + c.h, 0) + (node.children.length - 1) * 25;
    let startY = y - totalChildrenHeight / 2;
    
    node.children.forEach(c => {
        let childCenterY = startY + c.h / 2;
        positionNode(c, x - 120, childCenterY);
        startY += c.h + 25;
    });
}

function getMinX(node) {
    if (!node.children || node.children.length === 0) return node.x;
    return Math.min(node.x, ...node.children.map(getMinX));
}

function shiftTreeX(node, deltaX) {
    node.x += deltaX;
    if (node.children) {
        node.children.forEach(c => shiftTreeX(c, deltaX));
    }
}

function renderAST(node) {
    if (node.type === 'CONST') {
        return `<svg width="200" height="60"><text x="100" y="35" text-anchor="middle" font-family="sans-serif">Constant Output: ${node.value}</text></svg>`;
    }

    layoutNode(node);
    positionNode(node, node.w, node.h / 2 + 40);

    // Ensure left-most elements have ample breathing room from the edge
    let minX = getMinX(node);
    let leftPadding = 50;
    if (minX < leftPadding) {
        shiftTreeX(node, leftPadding - minX);
    }

    let svgWidth = node.x + 120;
    let svgHeight = node.h + 80;

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svg += drawConnections(node);
    svg += drawNodes(node);
    
    // Output wire and label
    let outPinX = (node.type === 'NAND' || node.type === 'NOR') ? node.x + 24 : (node.type === 'NOT' ? node.x + 18 : node.x + 20);
    svg += `<path d="M ${outPinX},${node.y} L ${outPinX + 35},${node.y}" stroke="#0f172a" stroke-width="2" fill="none"/>`;
    svg += `<text x="${outPinX + 45}" y="${node.y + 5}" font-family="sans-serif" font-weight="bold" font-size="14" fill="#0f172a">Out</text>`;
    svg += `</svg>`;
    return svg;
}

function drawConnections(node) {
    if (!node.children) return "";
    let svg = "";
    let numChildren = node.children.length;

    node.children.forEach((c, idx) => {
        let outX = (c.type === 'VAR' || c.type === 'CONST') 
                   ? c.x + 15 
                   : (c.type === 'NAND' || c.type === 'NOR') 
                     ? c.x + 24 
                     : (c.type === 'NOT' ? c.x + 18 : c.x + 20);
        
        let inX = (node.type === 'NOT') ? node.x - 15 : node.x - 20;

        // Distribute multi-input wires vertically to gate pins
        let inY = node.y;
        if (numChildren > 1) {
            let spread = Math.min(24, (numChildren - 1) * 12);
            let step = spread / (numChildren - 1);
            inY = (node.y - spread / 2) + idx * step;
        }

        let midX = (outX + inX) / 2;
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
        svg += `<rect x="${nx-15}" y="${ny-12}" width="30" height="24" rx="4" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/>`;
        svg += `<text x="${nx}" y="${ny+5}" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="middle">${node.value}</text>`;
    } else if (node.type === 'AND') {
        svg += `<path d="M ${nx-20},${ny-18} L ${nx},${ny-18} A 18,18 0 0,1 ${nx},${ny+18} L ${nx-20},${ny+18} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-6}" y="${ny+4}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">AND</text>`;
    } else if (node.type === 'OR') {
        svg += `<path d="M ${nx-20},${ny-18} Q ${nx-5},${ny-18} ${nx+8},${ny-9} Q ${nx+20},${ny} ${nx+8},${ny+9} Q ${nx-5},${ny+18} ${nx-20},${ny+18} Q ${nx-10},${ny} ${nx-20},${ny-18} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-3}" y="${ny+4}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">OR</text>`;
    } else if (node.type === 'NOT') {
        svg += `<polygon points="${nx-15},${ny-14} ${nx+8},${ny} ${nx-15},${ny+14}" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+13}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
    } else if (node.type === 'NAND') {
        svg += `<path d="M ${nx-20},${ny-18} L ${nx},${ny-18} A 18,18 0 0,1 ${nx},${ny+18} L ${nx-20},${ny+18} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+22}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-6}" y="${ny+4}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">NAND</text>`;
    } else if (node.type === 'NOR') {
        svg += `<path d="M ${nx-20},${ny-18} Q ${nx-5},${ny-18} ${nx+8},${ny-9} Q ${nx+20},${ny} ${nx+8},${ny+9} Q ${nx-5},${ny+18} ${nx-20},${ny+18} Q ${nx-10},${ny} ${nx-20},${ny-18} Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<circle cx="${nx+24}" cy="${ny}" r="4" fill="white" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${nx-3}" y="${ny+4}" font-size="9" font-family="sans-serif" text-anchor="middle" font-weight="bold">NOR</text>`;
    }
    return svg;
}
