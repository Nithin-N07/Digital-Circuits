// js/arithmetic.js

window.drawAdder = function() {
    const bits = parseInt(document.getElementById('bit-count').value);
    const svgLayer = document.getElementById('svg-layer');
    svgLayer.innerHTML = '';

    let startX = 100;
    const startY = 200;

    for(let i = 0; i < bits; i++) {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Full Adder Block
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", startX);
        rect.setAttribute("y", startY);
        rect.setAttribute("width", "80");
        rect.setAttribute("height", "100");
        rect.setAttribute("fill", "transparent");
        rect.setAttribute("stroke", "currentColor");
        rect.setAttribute("stroke-width", "2");
        rect.classList.add("text-gray-100");

        // Text label
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", startX + 25);
        text.setAttribute("y", startY + 55);
        text.setAttribute("fill", "currentColor");
        text.textContent = `FA ${i}`;

        // Wires
        // A, B inputs from top
        const wireA = document.createElementNS("http://www.w3.org/2000/svg", "line");
        wireA.setAttribute("x1", startX + 20); wireA.setAttribute("y1", startY - 30);
        wireA.setAttribute("x2", startX + 20); wireA.setAttribute("y2", startY);
        wireA.setAttribute("stroke", "#3b82f6"); wireA.setAttribute("stroke-width", "2");

        const wireB = document.createElementNS("http://www.w3.org/2000/svg", "line");
        wireB.setAttribute("x1", startX + 60); wireB.setAttribute("y1", startY - 30);
        wireB.setAttribute("x2", startX + 60); wireB.setAttribute("y2", startY);
        wireB.setAttribute("stroke", "#3b82f6"); wireB.setAttribute("stroke-width", "2");

        // Sum output from bottom
        const wireSum = document.createElementNS("http://www.w3.org/2000/svg", "line");
        wireSum.setAttribute("x1", startX + 40); wireSum.setAttribute("y1", startY + 100);
        wireSum.setAttribute("x2", startX + 40); wireSum.setAttribute("y2", startY + 130);
        wireSum.setAttribute("stroke", "#10b981"); wireSum.setAttribute("stroke-width", "2");

        group.appendChild(rect);
        group.appendChild(text);
        group.appendChild(wireA);
        group.appendChild(wireB);
        group.appendChild(wireSum);
        
        // Connect Carry Out to next Carry In
        if(i < bits - 1) {
            const wireCarry = document.createElementNS("http://www.w3.org/2000/svg", "path");
            wireCarry.setAttribute("d", `M ${startX + 80} ${startY + 50} L ${startX + 120} ${startY + 50}`);
            wireCarry.setAttribute("stroke", "#f59e0b");
            wireCarry.setAttribute("stroke-width", "2");
            group.appendChild(wireCarry);
        }

        svgLayer.appendChild(group);
        startX += 120; // Move right for next block
    }
}
