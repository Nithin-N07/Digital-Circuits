// js/solver.js

// 1. Tokenizer & Parser (Converts "A*B+C" into a Tree Structure)
function parseExpression(expr) {
    // Remove spaces and standardize operators
    let cleanExpr = expr.replace(/\s+/g, '').replace(/AND/gi, '*').replace(/OR/gi, '+').replace(/NOT/gi, "'");
    
    // Very basic AST builder (Handles basic A*B+C for demonstration)
    // In a full production app, you'd use a Recursive Descent Parser or Shunting Yard algorithm here.
    if (cleanExpr.includes('+')) {
        let parts = cleanExpr.split('+');
        return { type: 'OR', left: parseExpression(parts[0]), right: parseExpression(parts.slice(1).join('+')) };
    }
    if (cleanExpr.includes('*')) {
        let parts = cleanExpr.split('*');
        return { type: 'AND', left: parseExpression(parts[0]), right: parseExpression(parts.slice(1).join('*')) };
    }
    if (cleanExpr.includes("'")) {
        return { type: 'NOT', input: parseExpression(cleanExpr.replace("'", "")) };
    }
    return { type: 'INPUT', value: cleanExpr };
}

// 2. Evaluator
function evaluateTree(node, env) {
    if (node.type === 'INPUT') return env[node.value] ? 1 : 0;
    if (node.type === 'NOT') return evaluateTree(node.input, env) === 1 ? 0 : 1;
    if (node.type === 'AND') return evaluateTree(node.left, env) && evaluateTree(node.right, env);
    if (node.type === 'OR') return evaluateTree(node.left, env) || evaluateTree(node.right, env);
    return 0;
}

// 3. Truth Table Generator
function generateTruthTable(expr) {
    const variables = [...new Set(expr.match(/[A-Za-z]/g))].sort();
    const numVars = variables.length;
    const numRows = Math.pow(2, numVars);
    const ast = parseExpression(expr);
    
    let tableHTML = `<thead><tr class="border-b border-gray-600">`;
    variables.forEach(v => tableHTML += `<th class="p-2">${v}</th>`);
    tableHTML += `<th class="p-2 border-l border-gray-600 text-brand">Output</th></tr></thead><tbody>`;

    for (let i = 0; i < numRows; i++) {
        let env = {};
        // Convert row number to binary, pad with zeros
        let bin = i.toString(2).padStart(numVars, '0');
        
        let rowHTML = `<tr class="border-b border-gray-700/50">`;
        for (let j = 0; j < numVars; j++) {
            env[variables[j]] = parseInt(bin[j]);
            rowHTML += `<td class="p-2">${bin[j]}</td>`;
        }
        
        let out = evaluateTree(ast, env);
        rowHTML += `<td class="p-2 border-l border-gray-600 font-bold ${out ? 'text-green-500' : 'text-red-500'}">${out}</td></tr>`;
        tableHTML += rowHTML;
    }
    tableHTML += `</tbody>`;
    
    document.getElementById('truth-table-display').innerHTML = tableHTML;
    return ast; // Return tree to pass to the SVG engine
}
