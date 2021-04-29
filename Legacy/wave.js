let contentUrl = "https://en.wikipedia.org/w/api.php?&action=parse&prop=wikitext&format=json&page=Internet&origin=*";

let textElements;
let elementIndices;

let currentIndex = 0;

let spacing = 30;
let font_spacing = 20 / spacing;
let max_amplitude = 8;
let rx = 15;
let ry = 4;

let presentElements = 0;
let width;
let height;
let desiredElements;

let toReset;

let contentsElement = document.getElementById("content");

let content = "";

function main(message) {
    content = this.responseText.substring(this.responseText.indexOf(`"wikitext":`) + 10);
    console.log("Got text: ", content);
    // Clear the content window
    contentsElement.innerHTML = "";
    textElements = [];
    elementIndices = [];
    toReset = new Map();
    onResize();
    console.log("Keyframes: ", textElements[0].getAnimations()[0].effect.getKeyframes());
}

function fillWindow() {
    while (presentElements < desiredElements) {
        let element;
        if (presentElements < textElements.length) {
            element = textElements[presentElements];
            // Add child to parent
            contentsElement.appendChild(element);
        } else {
            element = createElement();
        }
        updateElement(element, presentElements);
        presentElements++;
    }
}

function trimWindow() {
    while(presentElements > desiredElements) {
        contentsElement.removeChild(textElements[presentElements - 1]);
        presentElements--;
    }
}

function onResize() {
    width = Math.ceil(window.innerWidth / spacing);
    height = Math.ceil(window.innerHeight / spacing)
    desiredElements = width * height;
    contentsElement.style.width = `${width * spacing}px`;
    //width--;
    if (textElements) {
        trimWindow();
        /*
        for(let [key, element] of toReset) {
            resetElement(key, element);
        }*/
        updateAnimation();
    }
    fillWindow();

}

function mouseMoved(event) {
    event = event || window.event;

    let mouseX = event.pageX / spacing;
    let frac = mouseX / width;
    let mouseY = event.pageY / spacing;

    let minX = Math.floor(Math.max(mouseX - rx, 0));
    let maxX = Math.ceil(Math.min(mouseX + rx, width));
    let minY = Math.floor(Math.max(mouseY - ry, 0));
    let maxY = Math.ceil(Math.min(mouseY + ry, height));

    
    if (toReset) {
        for(let [key, element] of toReset) {
            if(!key.inRange(minX, maxX, minY, maxY)) {
                resetElement(key, element);
            }
        }
    }
    
    for (let y = minY; y < maxY; y++) {
        let rowMin = elementIndices[width * y];
        let rowSize = elementIndices[width * (y + 1)] - rowMin;
        let centerIndex = frac * rowSize + rowMin;
        for (let x = minX; x < maxX; x++) {
            let i = y * width + x;
            let element = textElements[i];
            
            let fac = factor(mouseX - x, mouseY - y);
            let anims = element.getAnimations();
            if (fac) {
                let amp = (1 - fac) * max_amplitude;
                let di = elementIndices[i] - centerIndex;
                let offset = ((mouseX + di * font_spacing) - x) * fac * spacing; 
                anims[0].effect.setKeyframes([
                    {transform: `rotate(0deg) translateX(${amp}px) rotate(0deg)`},
                    {transform: `rotate(-360deg) translateX(${amp}px) rotate(360deg)`}
                ]);
                anims[0].effect.composite = "add";
                element.style.transform = `translateX(${offset}px)`;
                toReset.set(new coord(x, y), element);
            } else {
                // Reset animation
                resetElement(new coord(x, y), element);
            }
        }
    }

}

class coord {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    inRange(minX, maxX, minY, maxY) {
        if(this.x < minX || this.x > maxX) {
            return false;
        }
        return this.y > minY && this.y < maxY;
    }
}

function resetElement(key, element) {
    // Reset animation
    let anims = element.getAnimations();
    if (anims[0]) {
        anims[0].effect.setKeyframes([
            {transform: `rotate(0deg) translateX(${max_amplitude}px) rotate(0deg)`},
            {transform: `rotate(-360deg) translateX(${max_amplitude}px) rotate(360deg)`}
        ]);
        element.style.transform = "";
    }
    toReset.delete(key);
}

function factor(dx, dy) {
    dx /= rx;
    dy /= ry;
    return Math.max(1 - ((dx * dx) + (dy * dy)), 0);
}

function lerpIndex(x) {
    let fac = x;
    x = Math.floor(x);
    fac -= x;
    return (1 - fac) * elementIndices[x] + fac * elementIndices[x+1];
}

function updateAnimation() {
    for(let i = 0; i < presentElements; i++) {
        let element = textElements[i];
        updateElement(element, i);
    }
}

function updateElement(element, index) {
    let x = (index % width) * spacing;
    let y = (index / width) * spacing;
    element.style.animationDelay = `${-0.01 * (x + y)}s`;
    //element.style.top = `${y}px`;
    //element.style.left = `${x}px`;
}

function createElement() {
    let c = "";
    do {
        c = content.charAt(currentIndex);
        currentIndex++;
    } while (c.trim() == "");

    let element = document.createElement("span");
    element.innerHTML = c;
    contentsElement.appendChild(element);
    // Add styling
    element.classList.add("waving");
    // Push to list
    textElements.push(element);
    elementIndices.push(currentIndex - 1);
    element.getAnimations().forEach((animation) => {
        animation.effect.composite = "add";
    });
    return element;
}




function xhrSuccess() {
    this.callback.apply(this, this.arguments);
}

function xhrError() {
    console.error(this.statusText);
}

function loadFile(url, callback /*, opt_arg1, opt_arg2, ... */) {
    var xhr = new XMLHttpRequest();
    xhr.callback = callback;
    xhr.arguments = Array.prototype.slice.call(arguments, 2);
    xhr.onload = xhrSuccess;
    xhr.onerror = xhrError;
    xhr.open("GET", url, true);
    xhr.send(null);
}

function showMessage(message) {
    console.log(message, this.responseText);
}

loadFile(contentUrl, main, "Got message: ");


//loadFile(contentUrl, main);
window.onresize = onResize;
window.onmousemove = mouseMoved;
