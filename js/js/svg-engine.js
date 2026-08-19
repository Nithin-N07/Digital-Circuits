// js/svg-engine.js

const svgLayer = document.getElementById('svg-layer');

function createSVGNode(n, v) {
    n = document.createElementNS("http://www.w3.org/2000/svg", n);
    for (let p in v) n.setAttributeNS(null, p, v[p]);
    return n;
}

// Basic Gate Drawers
function drawGate(type, x, y) {
    const group = createSVGNode("g", { transform: `translate(${x}, ${y})`, class: "text-gray-900 dark:text-white" });
    
    let pathData = "";
    if (type === 'AND') pathData = "M 0 0 L 20 0 A 20 20 0 0 1 40 20 A 20 20 0 0 1 20 40 L 0 40 Z";
    if (type === 'OR') pathData = "M 0 0 Q 15 20 0 40 Q 30 40 40 20 Q 30 0 0 0 Z";
    if (type === 'NOT') pathData = "M 0 10 L 30 20 L 0 30 Z";

    const body = createSVGNode("path", { d: pathData, fill: "transparent", stroke: "currentColor", "stroke-width": "2" });
    
    // Bubble for NOT
    if(type === 'NOT') {
        const bubble = createSVGNode("circle", { cx: "35", cy: "20", r: "4", fill: "transparent", stroke: "currentColor", "stroke-width": "2" });
        group.appendChild(bubble);
    }

    group.appendChild(body);
    svgLayer.appendChild(group);
}

function drawWire(x1, y1, x2, y2) {
    const wire = createSVGNode("path", {
        d: `M ${x1} ${y1} L ${x1 + 10} ${y1} L ${x1 + 10} ${y2} L ${x2} ${y2}`,
        fill: "none", stroke: "#3b82f6", "stroke-width": "2"
    });
    svgLayer.appendChild(wire);
}

// The recursive Layout Algorithm
function renderTree(node, x, y, yOffset) {
    if (node.type === 'INPUT') {
        const text = createSVGNode("text", { x: x, y: y + 25, fill: "currentColor", "font-family": "monospace", "font-size": "16" });
        text.textContent = node.value;
        svgLayer.appendChild(text);
        return { outX: x + 15, outY: y + 20 };
    }

    // Draw children recursively
    let leftCoords = renderTree(node.left, x - 120, y - yOffset, yOffset / 2);
    let rightCoords = renderTree(node.right, x - 120, y + yOffset, yOffset / 2);

    // Draw this gate
    drawGate(node.type, x, y);

    // Connect wires from children to this gate
    drawWire(leftCoords.outX, leftCoords.outY, x, y + 10);
    drawWire(rightCoords.outX, rightCoords.outY, x, y + 30);

    return { outX: x + 40, outY: y + 20 };
}

// Master execution triggered by the UI button
window.generateEverything = function() {
    const input = document.getElementById('boolean-input').value;
    if(!input) return;
    
    svgLayer.innerHTML = ''; // Clear canvas
    document.getElementById('output-expression').innerText = input; // Show equation
    
    // 1. Generate Truth table & Get AST
    const ast = generateTruthTable(input);
    
    // 2. Render circuit starting from right (x=600) to left, center y=300
    renderTree(ast, 600, 300, 100);
    
    document.getElementById('verification-badge').classList.remove('hidden');
}
