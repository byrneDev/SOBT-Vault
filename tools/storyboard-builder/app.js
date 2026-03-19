const slidesList = document.getElementById('slidesList')
const canvas = document.getElementById('canvas')

// Make canvas larger for storyboard work and show boundaries clearly
if(canvas){
    canvas.style.width = '1366px'
    canvas.style.height = '664px'
    canvas.style.border = '2px dashed #58a6ff'
    canvas.style.borderRadius = '8px'
    canvas.style.boxSizing = 'border-box'
}

const addSlideBtn = document.getElementById('addSlideBtn')
const addSlideBtn2 = document.getElementById('addSlideBtn2')

if(addSlideBtn2){
    addSlideBtn2.textContent = "Add Slide"
    addSlideBtn2.style.fontSize = '12px'
}
const deleteSlideBtn = document.getElementById('deleteSlideBtn')
const duplicateSlideBtn = document.getElementById('duplicateSlideBtn')

const addTextBtn = document.getElementById('addTextBtn')
const addImageBtn = document.getElementById('addImageBtn')


const textInput = document.getElementById('textInput')

// Inspector formatting controls
const fontFamilyInput = document.getElementById('fontFamilyInput')
const fontSizeInput = document.getElementById('fontSizeInput')
const textColorInput = document.getElementById('textColorInput')
const shapeFillInput = document.getElementById('shapeFillInput')
const shapeBorderColorInput = document.getElementById('shapeBorderColorInput')
const shapeBorderWidthInput = document.getElementById('shapeBorderWidthInput')
const shapeTextInput = document.getElementById('shapeTextInput')
const shapeRadiusInput = document.getElementById('shapeRadiusInput')

const slideTitleInput = document.getElementById('slideTitleInput')
const slideNotesInput = document.getElementById('slideNotesInput')

const posXInput = document.getElementById('posX')
const posYInput = document.getElementById('posY')
const widthInput = document.getElementById('widthInput')
const heightInput = document.getElementById('heightInput')

// Allow local image uploads
const imageFileInput = document.createElement('input')
imageFileInput.type = 'file'
imageFileInput.accept = 'image/*'

const addRectBtn = document.getElementById('addRectBtn')
const addCircleBtn = document.getElementById('addCircleBtn')
const addTriangleBtn = document.getElementById('addTriangleBtn')

const exportBtn = document.getElementById('exportBtn')
const logOutput = document.getElementById('logOutput')

const gridToggleBtn = document.getElementById('gridToggleBtn')
const zoomInBtn = document.getElementById('zoomInBtn')
const zoomOutBtn = document.getElementById('zoomOutBtn')
const zoomDisplay = document.getElementById('zoomDisplay')


// Toolbar controls
const boldBtn = document.getElementById('boldBtn')
const italicBtn = document.getElementById('italicBtn')
const underlineBtn = document.getElementById('underlineBtn')

const alignLeftBtn = document.getElementById('alignLeftBtn')
const alignCenterBtn = document.getElementById('alignCenterBtn')
const alignRightBtn = document.getElementById('alignRightBtn')

const toolbarFontFamily = document.getElementById('toolbarFontFamily')
const toolbarFontSize = document.getElementById('toolbarFontSize')
const toolbarTextColor = document.getElementById('toolbarTextColor')


function log(msg)
{
    const t = new Date().toLocaleTimeString()
    logOutput.textContent += `[${t}] ${msg}\n`
    logOutput.scrollTop = logOutput.scrollHeight
}



let slides = []
let activeSlide = null

// --- Local Persistence ---
const STORAGE_KEY = "sobt_storyboard_data"

const PROJECT_META = {
    name: "Storyboard Project",
    created: new Date().toISOString()
}

// --- Workspace ZIP Support ---
let workspaceAssets = {}
// --- Workspace ZIP Export ---
async function exportWorkspaceZip(){
    try{
        const zip = new JSZip()

        const snapshot = getWorkspaceSnapshot()

        // main project file
        zip.file("project.json", JSON.stringify(snapshot, null, 2))

        // assets folder (images from elements)
        const assetsFolder = zip.folder("assets")

        slides.forEach(slide => {
            slide.elements.forEach((el, idx) => {
                if(el.type === "image" && el.src && el.src.startsWith("data:")){
                    const base64 = el.src.split(',')[1]
                    const fileName = `img_${slide.id}_${idx}.png`

                    assetsFolder.file(fileName, base64, { base64: true })

                    // replace src for portability
                    el._assetRef = fileName
                }
            })
        })

        const blob = await zip.generateAsync({ type: "blob" })

        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = "workspace.zip"
        a.click()

        log("Workspace exported (ZIP)")
    }catch(e){
        console.error("Workspace ZIP export failed", e)
    }
}

// --- Workspace ZIP Import ---
async function importWorkspaceZip(file){
    try{
        const zip = await JSZip.loadAsync(file)

        const projectFile = zip.file("project.json")
        if(!projectFile){
            log("Invalid workspace ZIP")
            return
        }

        const content = await projectFile.async("string")
        const data = JSON.parse(content)

        slides = data.slides || []
        activeSlide = slides.find(s => s.id === data.activeSlideId) || slides[0] || null

        // restore images
        const assetsFolder = zip.folder("assets")
        if(assetsFolder){
            const files = Object.keys(assetsFolder.files)

            for(const path of files){
                const fileObj = assetsFolder.files[path]
                if(!fileObj.dir){
                    const base64 = await fileObj.async("base64")
                    const dataUrl = `data:image/png;base64,${base64}`

                    slides.forEach(slide => {
                        slide.elements.forEach(el => {
                            if(el._assetRef === fileObj.name){
                                el.src = dataUrl
                            }
                        })
                    })
                }
            }
        }

        renderSlides()
        renderCanvas()

        log("Workspace loaded (ZIP)")
    }catch(e){
        console.error("Workspace ZIP load failed", e)
    }
}

function saveProject(){
    try{
        const data = {
            version: "1.0",
            slides,
            activeSlideId: activeSlide?.id || null,
            assets: {} // future-proof for ZIP system
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }catch(e){
        console.error("Save failed", e)
    }
}

// --- Debounced Save System ---
let saveTimeout = null;
function scheduleSave(){
    if(saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(()=>{
        saveProject();
        updateSaveIndicator("Saved");
    }, 500);
}

function updateSaveIndicator(text){
    let el = document.getElementById('saveIndicator');
    if(!el){
        el = document.createElement('div');
        el.id = 'saveIndicator';
        el.style.position = 'fixed';
        el.style.bottom = '10px';
        el.style.right = '10px';
        el.style.fontSize = '12px';
        el.style.color = '#9ca3af';
        document.body.appendChild(el);
    }
    el.textContent = text;
}

function resetWorkspace(){
    localStorage.removeItem(STORAGE_KEY);
    slides = [];
    activeSlide = null;
    renderSlides();
    renderCanvas();
    log("Workspace reset");
}

function loadProject(){
    try{
        const raw = localStorage.getItem(STORAGE_KEY)
        if(!raw) return false

        const data = JSON.parse(raw)

        slides = Array.isArray(data.slides) ? data.slides : []
        activeSlide = slides.find(s => s.id === data.activeSlideId) || slides[0] || null

        // future: assets support
        if(data.assets){
            // placeholder (no-op for now)
        }

        renderSlides()
        renderCanvas()
        return true
    }catch(e){
        console.error("Load failed", e)
        return false
    }
}

function getWorkspaceSnapshot(){
    return {
        version: "1.0",
        meta: PROJECT_META,
        slides,
        activeSlideId: activeSlide?.id || null
    }
}

// --- Export/Import Project as JSON ---
function exportProject(){
    try{
        const data = JSON.stringify({ slides }, null, 2)
        const blob = new Blob([data], { type: "application/json" })
        const url = URL.createObjectURL(blob)

        const a = document.createElement("a")
        a.href = url
        a.download = "storyboard_project.json"
        a.click()

        log("Project exported (.json)")
    }catch(e){
        console.error("Export project failed", e)
    }
}

function importProject(file){
    const reader = new FileReader()

    reader.onload = (e)=>{
        try{
            const data = JSON.parse(e.target.result)
            if(!data.slides) return

            slides = data.slides
            activeSlide = slides[0] || null

            renderSlides()
            renderCanvas()

            log("Project loaded (.json)")
        }catch(err){
            console.error("Import failed", err)
        }
    }

    reader.readAsText(file)
}

// --- Undo / Redo state ---
let undoStack = []
let redoStack = []

function saveState(){
    undoStack.push(JSON.stringify(slides))
    redoStack = []
}

function undo(){
    if(undoStack.length === 0) return

    redoStack.push(JSON.stringify(slides))
    slides = JSON.parse(undoStack.pop())

    activeSlide = slides[slides.length-1] || null

    renderSlides()
    renderCanvas()
    log("Undo")
}

function redo(){
    if(redoStack.length === 0) return

    undoStack.push(JSON.stringify(slides))
    slides = JSON.parse(redoStack.pop())

    activeSlide = slides[slides.length-1] || null

    renderSlides()
    renderCanvas()
    log("Redo")
}


let selectedElements = []
let elementClipboard = []

let editingNode = null

// Marquee (drag-box) multi-select state
let selectionBox = null
let selectionStartX = 0
let selectionStartY = 0

function updateInspector(){
    if(selectedElements.length === 0) return
    const selectedElement = selectedElements[0]

    if(textInput && selectedElement.type === "text")
        textInput.value = selectedElement.content || ""

    if(posXInput) posXInput.value = selectedElement.x || 0
    if(posYInput) posYInput.value = selectedElement.y || 0

    if(widthInput) widthInput.value = selectedElement.w || ""
    if(heightInput) heightInput.value = selectedElement.h || ""

    // Formatting controls
    if(fontFamilyInput) fontFamilyInput.value = selectedElement.fontFamily || "Arial"
    if(fontSizeInput) fontSizeInput.value = selectedElement.fontSize || ""
    if(textColorInput) textColorInput.value = selectedElement.color || "#ffffff"

    if(shapeFillInput) shapeFillInput.value = selectedElement.fillColor || "#1f6feb"
    if(shapeBorderColorInput) shapeBorderColorInput.value = selectedElement.borderColor || "#58a6ff"
    if(shapeBorderWidthInput) shapeBorderWidthInput.value = selectedElement.borderWidth || ""
    if(shapeTextInput) shapeTextInput.value = selectedElement.text || ""
    if(shapeRadiusInput) shapeRadiusInput.value = selectedElement.radius || 0

    // Sync toolbar active states
    if(selectedElement.type === "text"){
        if(boldBtn) boldBtn.classList.toggle("active", selectedElement.fontWeight === "bold")
        if(italicBtn) italicBtn.classList.toggle("active", selectedElement.fontStyle === "italic")
        if(underlineBtn) underlineBtn.classList.toggle("active", selectedElement.textDecoration === "underline")

        if(alignLeftBtn) alignLeftBtn.classList.toggle("active", selectedElement.align === "left")
        if(alignCenterBtn) alignCenterBtn.classList.toggle("active", selectedElement.align === "center")
        if(alignRightBtn) alignRightBtn.classList.toggle("active", selectedElement.align === "right")
    }else{
        if(boldBtn) boldBtn.classList.remove("active")
        if(italicBtn) italicBtn.classList.remove("active")
        if(underlineBtn) underlineBtn.classList.remove("active")

        if(alignLeftBtn) alignLeftBtn.classList.remove("active")
        if(alignCenterBtn) alignCenterBtn.classList.remove("active")
        if(alignRightBtn) alignRightBtn.classList.remove("active")
    }
}


const GRID_SIZE = 10

// Alignment guide elements
const guideV = document.createElement("div")
const guideH = document.createElement("div")

guideV.style.position = "absolute"
guideV.style.width = "1px"
guideV.style.background = "#58a6ff"
guideV.style.top = "0"
guideV.style.bottom = "0"
guideV.style.pointerEvents = "none"
guideV.style.display = "none"

guideH.style.position = "absolute"
guideH.style.height = "1px"
guideH.style.background = "#58a6ff"
guideH.style.left = "0"
guideH.style.right = "0"
guideH.style.pointerEvents = "none"
guideH.style.display = "none"

canvas.appendChild(guideV)
canvas.appendChild(guideH)


let zoomLevel = 1
let gridEnabled = true

// Panning state
let panMode = false
let panStartX = 0
let panStartY = 0


function createSlide()
{
    const slide =
        {
            id: Date.now(),
            title: "New Slide",
            notes: "",
            elements:[]
        }

    slides.push(slide)
    activeSlide = slide

    renderSlides()
    renderCanvas()

    log("Slide created")
}


function deleteSlide()
{
    if(!activeSlide) return

    slides = slides.filter(s => s.id !== activeSlide.id)
    activeSlide = slides[0] || null

    renderSlides()
    renderCanvas()

    log("Slide deleted")
}


function duplicateSlide(){
    if(!activeSlide) return

    // deep clone the slide
    const clone = JSON.parse(JSON.stringify(activeSlide))

    clone.id = Date.now()

    const index = slides.findIndex(s => s.id === activeSlide.id)

    slides.splice(index + 1, 0, clone)

    activeSlide = clone

    renderSlides()
    renderCanvas()

    log("Slide duplicated")
}


function renderSlides()
{
    slidesList.innerHTML = ""

    slides.forEach((slide, i) => {

        const div = document.createElement("div")
        div.className = "slide-item"

        if(activeSlide && slide.id === activeSlide.id)
            div.classList.add("active")

        const row = document.createElement("div")
        row.style.display = "flex"
        row.style.alignItems = "center"
        row.style.gap = "8px"

        const thumb = document.createElement("canvas")
        thumb.width = 120
        thumb.height = 70
        thumb.style.border = "1px solid #30363d"
        thumb.style.background = "#0d1117"

        const ctx = thumb.getContext("2d")

        slide.elements.forEach(el => {

            const x = (el.x || 0) / 10
            const y = (el.y || 0) / 10

            if(el.type === "text"){
                ctx.fillStyle = "#e6edf3"
                ctx.font = "10px sans-serif"
                ctx.fillText(el.content || "Text", x, y + 10)
            }

            if(el.type === "rect"){
                ctx.strokeStyle = "#58a6ff"
                ctx.strokeRect(x, y, (el.w || 120)/10, (el.h || 80)/10)
            }

            if(el.type === "circle"){
                ctx.strokeStyle = "#f2c94c"
                ctx.beginPath()
                ctx.arc(x + (el.w||100)/20, y + (el.h||100)/20, (el.w||100)/20, 0, Math.PI*2)
                ctx.stroke()
            }

            if(el.type === "triangle"){
                const w = (el.w||120)/10
                const h = (el.h||100)/10
                ctx.fillStyle = "#58a6ff"
                ctx.beginPath()
                ctx.moveTo(x + w/2, y)
                ctx.lineTo(x, y + h)
                ctx.lineTo(x + w, y + h)
                ctx.closePath()
                ctx.fill()
            }
        })

        const title = document.createElement("div")
        title.textContent = slide.title || ("Slide " + (i+1))

        row.appendChild(thumb)
        row.appendChild(title)

        div.appendChild(row)

        div.onclick = () => {
            activeSlide = slide
            if(slideTitleInput) slideTitleInput.value = slide.title || ""
            if(slideNotesInput) slideNotesInput.value = slide.notes || ""
            renderSlides()
            renderCanvas()
        }

        slidesList.appendChild(div)

    })
    scheduleSave()
}


function renderCanvas()
{
    canvas.innerHTML = ""

    if(!activeSlide) return

    // Recursive render helper for groups
    function renderElement(el){
        if(el.type === "group"){
            el.elements.forEach(child => renderElement(child))
            return
        }

        let node

        if(el.type === "text"){
            node = document.createElement("div")
            node.className = "canvas-text"
            node.textContent = el.content

            // Apply text styling properties
            node.style.fontFamily = el.fontFamily || "Arial"
            node.style.fontSize = (el.fontSize || 24) + "px"
            node.style.fontWeight = el.fontWeight || "normal"
            node.style.color = el.color || "#ffffff"
            node.style.textAlign = el.align || "left"
            node.style.fontStyle = el.fontStyle || "normal"
            node.style.textDecoration = el.textDecoration || "none"

            // Inline editing (double-click to edit text directly on canvas)
            node.ondblclick = (e) => {
                e.stopPropagation()

                editingNode = node

                node.contentEditable = true
                node.style.cursor = "text"
                node.focus()

                const finishEdit = () => {
                    node.contentEditable = false
                    el.content = node.textContent
                    editingNode = null
                    updateInspector()
                    renderCanvas()
                }

                node.onblur = finishEdit

                node.onkeydown = (ev) => {
                    if(ev.key === "Enter"){
                        ev.preventDefault()
                        node.blur()
                    }
                }
            }

            // Apply stored size if resized
            if(el.w) node.style.width = el.w + "px"
            if(el.h) node.style.height = el.h + "px"
        }

        if(el.type === "image"){
            // Use a wrapper so resize handles can be attached
            node = document.createElement("div")
            node.className = "canvas-image"

            const img = document.createElement("img")
            img.src = el.src
            img.style.width = "100%"
            img.style.height = "100%"
            img.style.pointerEvents = "none"

            // Ensure images have size so resize works
            if(!el.w) el.w = 180
            if(!el.h) el.h = 120

            node.style.width = el.w + "px"
            node.style.height = el.h + "px"

            node.appendChild(img)
        }

        if(el.type === "rect"){
            node = document.createElement("div")
            node.className = "canvas-rect"
            node.style.width = (el.w || 120) + "px"
            node.style.height = (el.h || 80) + "px"
            node.style.background = el.fillColor || "#1f6feb33"
            node.style.border = (el.borderWidth || 1) + "px solid " + (el.borderColor || "#58a6ff")
            node.style.borderRadius = (el.radius || 0) + "px"

            if(el.text){
                const label = document.createElement("div")
                label.textContent = el.text
                label.style.position = "absolute"
                label.style.left = "50%"
                label.style.top = "50%"
                label.style.transform = "translate(-50%, -50%)"
                label.style.pointerEvents = "none"
                label.style.color = "#ffffff"
                node.appendChild(label)
            }
        }

        if(el.type === "circle"){
            node = document.createElement("div")
            node.className = "canvas-circle"
            node.style.width = (el.w || 100) + "px"
            node.style.height = (el.h || 100) + "px"
            node.style.background = el.fillColor || "#f2c94c33"
            node.style.border = (el.borderWidth || 1) + "px solid " + (el.borderColor || "#f2c94c")
            node.style.borderRadius = "50%"

            if(el.text){
                const label = document.createElement("div")
                label.textContent = el.text
                label.style.position = "absolute"
                label.style.left = "50%"
                label.style.top = "50%"
                label.style.transform = "translate(-50%, -50%)"
                label.style.pointerEvents = "none"
                label.style.color = "#ffffff"
                node.appendChild(label)
            }
        }

        if(el.type === "triangle"){
            node = document.createElement("div")
            node.className = "canvas-triangle"

            if(!el.w) el.w = 120
            if(!el.h) el.h = 100

            node.style.width = el.w + "px"
            node.style.height = el.h + "px"

            // Two-layer triangle for border
            if(el.borderWidth && el.borderWidth > 0){
                // Border triangle (outer)
                const borderTri = document.createElement("div")
                borderTri.style.position = "absolute"
                borderTri.style.left = "0"
                borderTri.style.top = "0"
                borderTri.style.width = "100%"
                borderTri.style.height = "100%"
                borderTri.style.background = el.borderColor || "#58a6ff"
                borderTri.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)"
                node.appendChild(borderTri)

                // Inner triangle (smaller, for fill)
                const innerTri = document.createElement("div")
                innerTri.style.position = "absolute"
                innerTri.style.left = el.borderWidth + "px"
                innerTri.style.top = el.borderWidth + "px"
                innerTri.style.width = `calc(100% - ${el.borderWidth * 2}px)`
                innerTri.style.height = `calc(100% - ${el.borderWidth * 2}px)`
                innerTri.style.background = el.fillColor || "#58a6ff"
                innerTri.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)"
                innerTri.style.pointerEvents = "none"
                node.appendChild(innerTri)
            }else{
                // Single triangle (no border)
                const tri = document.createElement("div")
                tri.style.width = "100%"
                tri.style.height = "100%"
                tri.style.background = el.fillColor || "#58a6ff"
                tri.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)"
                tri.style.pointerEvents = "none"
                tri.style.position = "absolute"
                tri.style.left = "0"
                tri.style.top = "0"
                node.appendChild(tri)
            }

            if(el.text){
                const label = document.createElement("div")
                label.textContent = el.text
                label.style.position = "absolute"
                label.style.left = "50%"
                label.style.top = "65%"
                label.style.transform = "translate(-50%, -50%)"
                label.style.pointerEvents = "none"
                label.style.color = "#ffffff"
                node.appendChild(label)
            }
        }

        // Ensure elements can move freely inside the canvas
        node.style.position = "absolute";
        node.style.boxSizing = "border-box";
        node.style.display = "block";

        // Allow text elements to be editable
        if(el.type === "text"){
            node.style.userSelect = "text";
            node.style.cursor = "text";
        }else{
            node.style.userSelect = "none";
            node.style.cursor = "move";
        }

        // Apply stored position
        node.style.left = (el.x || 0) + "px"
        node.style.top = (el.y || 0) + "px"

        // Apply rotation if present
        if(el.rotation){
            node.style.transform = `rotate(${el.rotation}deg)`
        }

        // Selection behavior (do not re-render on mousedown)
        node.onclick = (e) => {
            if (editingNode) return

            if (e.detail === 2) return

            e.stopPropagation()

            if(e.shiftKey){
                if(!selectedElements.includes(el))
                    selectedElements.push(el)
            }else{
                selectedElements = [el]
            }

            updateInspector()
            renderCanvas()
        }

        if(selectedElements.includes(el)){
            node.style.outline = "2px solid #58a6ff"
            node.style.boxShadow = "0 0 0 2px #58a6ff55"

            // Delete button overlay
            const del = document.createElement("div")
            del.textContent = "✕"
            del.style.position = "absolute"
            del.style.top = "-10px"
            del.style.right = "-10px"
            del.style.width = "20px"
            del.style.height = "20px"
            del.style.background = "#f85149"
            del.style.color = "#fff"
            del.style.fontSize = "12px"
            del.style.display = "flex"
            del.style.alignItems = "center"
            del.style.justifyContent = "center"
            del.style.borderRadius = "50%"
            del.style.cursor = "pointer"

            del.onclick = (e)=>{
                e.stopPropagation()
                activeSlide.elements = activeSlide.elements.filter(x=>x!==el)
                selectedElements = []
                renderCanvas()
                log("Element deleted")
            }

            node.appendChild(del)

            // Rotation handle
            const rotateHandle = document.createElement("div")
            rotateHandle.style.position = "absolute"
            rotateHandle.style.top = "-25px"
            rotateHandle.style.left = "50%"
            rotateHandle.style.transform = "translateX(-50%)"
            rotateHandle.style.width = "12px"
            rotateHandle.style.height = "12px"
            rotateHandle.style.background = "#ffffff"
            rotateHandle.style.border = "2px solid #58a6ff"
            rotateHandle.style.borderRadius = "50%"
            rotateHandle.style.cursor = "grab"
            rotateHandle.style.zIndex = "25"

            rotateHandle.onmousedown = (e)=>{
                e.stopPropagation()

                const rect = node.getBoundingClientRect()
                const centerX = rect.left + rect.width/2
                const centerY = rect.top + rect.height/2

                document.onmousemove = (ev)=>{
                    const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * 180 / Math.PI
                    el.rotation = angle
                    renderCanvas()
                }

                document.onmouseup = ()=>{
                    document.onmousemove = null
                }
            }

            node.appendChild(rotateHandle)
        }

        // Enable drag for this element
        enableDrag(node, el)

        // Allow resizing for all element types including triangles
        enableResize(node, el)

        canvas.appendChild(node)
    }

    activeSlide.elements.forEach(el => renderElement(el))
    scheduleSave()
}

canvas.onclick = () => {
    if (editingNode) return

    selectedElements = []
    renderCanvas()
}

// Marquee (drag-box) multi-select mouse handling
canvas.addEventListener("mousedown", (e)=>{
    if(panMode) return
    if(e.target !== canvas) return

    selectionStartX = e.offsetX
    selectionStartY = e.offsetY

    selectionBox = document.createElement("div")
    selectionBox.style.position = "absolute"
    selectionBox.style.border = "1px dashed #58a6ff"
    selectionBox.style.background = "rgba(88,166,255,0.15)"
    selectionBox.style.left = selectionStartX + "px"
    selectionBox.style.top = selectionStartY + "px"

    canvas.appendChild(selectionBox)

    document.onmousemove = (ev)=>{
        const rect = canvas.getBoundingClientRect()
        const x = ev.clientX - rect.left
        const y = ev.clientY - rect.top

        const w = x - selectionStartX
        const h = y - selectionStartY

        selectionBox.style.width = Math.abs(w) + "px"
        selectionBox.style.height = Math.abs(h) + "px"
        selectionBox.style.left = (w < 0 ? x : selectionStartX) + "px"
        selectionBox.style.top = (h < 0 ? y : selectionStartY) + "px"
    }

    document.onmouseup = (ev)=>{
        document.onmousemove = null

        const boxLeft = parseFloat(selectionBox.style.left)
        const boxTop = parseFloat(selectionBox.style.top)
        const boxWidth = parseFloat(selectionBox.style.width) || 0
        const boxHeight = parseFloat(selectionBox.style.height) || 0

        const boxRight = boxLeft + boxWidth
        const boxBottom = boxTop + boxHeight

        selectedElements = activeSlide.elements.filter(el=>{
            const ex = el.x || 0
            const ey = el.y || 0
            const ew = el.w || 40
            const eh = el.h || 40

            const elRight = ex + ew
            const elBottom = ey + eh

            return (
                ex >= boxLeft &&
                ey >= boxTop &&
                elRight <= boxRight &&
                elBottom <= boxBottom
            )
        })

        // Remove selection box
        if(selectionBox && selectionBox.parentElement)
            selectionBox.remove()

        selectionBox = null

        updateInspector()
        renderCanvas()
    }
})


document.addEventListener("keydown", (e) => {
    // Reset workspace (Ctrl+Shift+R)
    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r"){
        e.preventDefault();
        resetWorkspace();
    }

    // Undo / Redo shortcuts
    if(e.ctrlKey && e.key.toLowerCase() === "z" && !e.shiftKey){
        undo()
        return
    }

    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z"){
        redo()
        return
    }

    // Copy elements (Ctrl + C)
    if(e.ctrlKey && e.key.toLowerCase() === "c"){
        if(!activeSlide || selectedElements.length === 0) return

        elementClipboard = selectedElements.map(el => JSON.parse(JSON.stringify(el)))
        log("Elements copied")
        return
    }

    // Paste elements (Ctrl + V)
    if(e.ctrlKey && e.key.toLowerCase() === "v"){
        if(!activeSlide || elementClipboard.length === 0) return

        const clones = elementClipboard.map(el => {
            const c = JSON.parse(JSON.stringify(el))
            c.x = (c.x || 0) + 20
            c.y = (c.y || 0) + 20
            return c
        })

        saveState()
        activeSlide.elements.push(...clones)
        selectedElements = clones

        renderCanvas()
        log("Elements pasted")
        return
    }

    // Duplicate element(s) (Ctrl + D)
    if(e.ctrlKey && e.key.toLowerCase() === "d"){
        if(!activeSlide || selectedElements.length === 0) return

        const clones = selectedElements.map(el=>{
            const c = JSON.parse(JSON.stringify(el))
            c.x = (c.x||0)+20
            c.y = (c.y||0)+20
            return c
        })

        saveState()
        activeSlide.elements.push(...clones)
        selectedElements = clones

        renderCanvas()
        log("Elements duplicated")
        return
    }

    // Group elements (Ctrl + G)
    if(e.ctrlKey && e.key.toLowerCase() === "g" && !e.shiftKey){
        if(!activeSlide || selectedElements.length < 2) return

        const group = {
            type: "group",
            elements: selectedElements.map(el => JSON.parse(JSON.stringify(el)))
        }

        saveState()
        activeSlide.elements = activeSlide.elements.filter(el => !selectedElements.includes(el))
        activeSlide.elements.push(group)

        selectedElements = [group]
        renderCanvas()
        log("Elements grouped")
        return
    }

    // Ungroup elements (Ctrl + Shift + G)
    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "g"){
        if(!activeSlide || selectedElements.length !== 1) return

        const group = selectedElements[0]
        if(group.type !== "group") return

        saveState()
        activeSlide.elements = activeSlide.elements.filter(el => el !== group)
        activeSlide.elements.push(...group.elements)

        selectedElements = group.elements
        renderCanvas()
        log("Elements ungrouped")
        return
    }

    if(e.key === "Delete") {
        if(!activeSlide || selectedElements.length === 0) return

        saveState()

        activeSlide.elements = activeSlide.elements.filter(el => !selectedElements.includes(el))

        selectedElements = []

        renderCanvas()

        log("Element deleted")
        return
    }

    // Arrow key nudge movement
    if(!activeSlide || selectedElements.length === 0) return

    const targets = selectedElements
    let step = e.shiftKey ? 10 : 1

    if(e.key === "ArrowLeft"){
        targets.forEach(t=> t.x = (t.x||0) - step)
        renderCanvas()
        return
    }

    if(e.key === "ArrowRight"){
        targets.forEach(t=> t.x = (t.x||0) + step)
        renderCanvas()
        return
    }

    if(e.key === "ArrowUp"){
        targets.forEach(t=> t.y = (t.y||0) - step)
        renderCanvas()
        return
    }

    if(e.key === "ArrowDown"){
        targets.forEach(t=> t.y = (t.y||0) + step)
        renderCanvas()
        return
    }

    // Layer controls (still only for first selected)
    if(!activeSlide || selectedElements.length === 0) return

    const selectedElement = selectedElements[0]
    const index = activeSlide.elements.indexOf(selectedElement)

    // Bring forward (Ctrl + ] )
    if(e.ctrlKey && e.key === "]"){
        if(index < activeSlide.elements.length - 1){
            const tmp = activeSlide.elements[index + 1]
            activeSlide.elements[index + 1] = selectedElement
            activeSlide.elements[index] = tmp
            renderCanvas()
            log("Element brought forward")
        }
    }

    // Send backward (Ctrl + [ )
    if(e.ctrlKey && e.key === "["){
        if(index > 0){
            const tmp = activeSlide.elements[index - 1]
            activeSlide.elements[index - 1] = selectedElement
            activeSlide.elements[index] = tmp
            renderCanvas()
            log("Element sent backward")
        }
    }
})

// SPACE key enables pan mode
window.addEventListener("keydown", (e)=>{
    if(e.code === "Space"){
        panMode = true
        canvas.style.cursor = "grab"
    }
})

window.addEventListener("keyup", (e)=>{
    if(e.code === "Space"){
        panMode = false
        canvas.style.cursor = "default"
    }
})

canvas.addEventListener("mousedown", (e)=>{
    if(!panMode) return

    e.preventDefault()

    panStartX = e.clientX
    panStartY = e.clientY

    const startScrollX = canvas.parentElement.scrollLeft
    const startScrollY = canvas.parentElement.scrollTop

    document.onmousemove = (ev)=>{
        const dx = ev.clientX - panStartX
        const dy = ev.clientY - panStartY

        canvas.parentElement.scrollLeft = startScrollX - dx
        canvas.parentElement.scrollTop = startScrollY - dy
    }

    document.onmouseup = ()=>{
        document.onmousemove = null
    }
})


function enableDrag(node, model)
{
    let offsetX, offsetY

    node.addEventListener("mousedown", (e) => {

        if (node.isContentEditable) return

        // Ignore resize handles or delete button
        if (e.target !== node && e.target.parentElement !== node) return

        if(!selectedElements.includes(model)){
            selectedElements = [model]
            updateInspector()
            // DO NOT renderCanvas() here
        }

        offsetX = e.offsetX
        offsetY = e.offsetY

        // Support multi-drag for all selected elements
        const dragStartPositions = selectedElements.map(el => ({
            el,
            x: el.x || 0,
            y: el.y || 0
        }))

        const startMouseX = e.clientX
        const startMouseY = e.clientY

        document.onmousemove = (ev) => {
            const dx = (ev.clientX - startMouseX) / zoomLevel
            const dy = (ev.clientY - startMouseY) / zoomLevel

            dragStartPositions.forEach(start => {
                const slideWidth = 1366
                const slideHeight = 664

                const elW = start.el.w || node.offsetWidth || 40
                const elH = start.el.h || node.offsetHeight || 40

                let maxX = slideWidth - elW
                let maxY = slideHeight - elH

                start.el.x = Math.round(Math.max(0, Math.min(start.x + dx, maxX)) / GRID_SIZE) * GRID_SIZE
                start.el.y = Math.round(Math.max(0, Math.min(start.y + dy, maxY)) / GRID_SIZE) * GRID_SIZE
            })

            renderCanvas()
        }

        document.onmouseup = () => {
            document.onmousemove = null
            guideV.style.display = "none"
            guideH.style.display = "none"
        }

    })
}

function enableResize(node, model)
{
    const handles = [
        {x:"left",y:"top",cursor:"nwse-resize"},
        {x:"right",y:"top",cursor:"nesw-resize"},
        {x:"left",y:"bottom",cursor:"nesw-resize"},
        {x:"right",y:"bottom",cursor:"nwse-resize"}
    ]

    handles.forEach(h=>{

        const handle=document.createElement("div")
        handle.style.position="absolute"
        handle.style.width="12px"
        handle.style.height="12px"
        handle.style.background="#ffffff"
        handle.style.border="2px solid #58a6ff"
        handle.style.borderRadius="2px"
        handle.style.zIndex = "20"
        handle.style.pointerEvents = "auto"
        handle.style.cursor=h.cursor

        handle.style[h.x]="0px"
        handle.style[h.y]="0px"

        node.appendChild(handle)

        handle.onmousedown=(e)=>{
            e.stopPropagation()

            const startX=e.pageX
            const startY=e.pageY

            const startW=model.w||node.offsetWidth
            const startH=model.h||node.offsetHeight

            document.onmousemove=(e)=>{

                const dx=e.pageX-startX
                const dy=e.pageY-startY

                model.w=Math.max(40,startW+dx)
                model.h=Math.max(40,startH+dy)

                node.style.width=model.w+"px"
                node.style.height=model.h+"px"

            }

            document.onmouseup=()=>{
                document.onmousemove=null
            }
        }

    })
}


addSlideBtn.onclick = createSlide
addSlideBtn2.onclick = createSlide

deleteSlideBtn.onclick = deleteSlide

if(duplicateSlideBtn)
    duplicateSlideBtn.onclick = duplicateSlide


addTextBtn.onclick = () => {

    if(!activeSlide) return

    saveState()

    activeSlide.elements.push({
        type: "text",
        content: textInput.value,
        x: 40,
        y: 40,
        w: 200,
        h: 60,
        rotation: 0,

        // text styling
        fontFamily: "Arial",
        fontSize: 24,
        fontWeight: "normal",
        color: "#ffffff",
        align: "left"
    })

    renderCanvas()
}

// Inspector editing for selected text element
if(textInput){
    textInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const selectedElement = selectedElements[0]
        if(selectedElement.type === "text"){
            selectedElement.content = textInput.value
            renderCanvas()
        }
    })
}

// Inspector position editing
if(posXInput){
    posXInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const selectedElement = selectedElements[0]
        selectedElement.x = parseInt(posXInput.value) || 0
        renderCanvas()
    })
}

if(posYInput){
    posYInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const selectedElement = selectedElements[0]
        selectedElement.y = parseInt(posYInput.value) || 0
        renderCanvas()
    })
}

// Inspector size editing
if(widthInput){
    widthInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const selectedElement = selectedElements[0]
        selectedElement.w = parseInt(widthInput.value) || selectedElement.w
        renderCanvas()
    })
}

if(heightInput){
    heightInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const selectedElement = selectedElements[0]
        selectedElement.h = parseInt(heightInput.value) || selectedElement.h
        renderCanvas()
    })
}

// Font family
if(fontFamilyInput){
    fontFamilyInput.addEventListener("change", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.fontFamily = fontFamilyInput.value
        renderCanvas()
    })
}

// Font size
if(fontSizeInput){
    fontSizeInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.fontSize = parseInt(fontSizeInput.value) || el.fontSize
        renderCanvas()
    })
}

// Text color
if(textColorInput){
    textColorInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.color = textColorInput.value
        renderCanvas()
    })
}

// Shape fill color
if(shapeFillInput){
    shapeFillInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.fillColor = shapeFillInput.value
        renderCanvas()
    })
}

// Shape border color
if(shapeBorderColorInput){
    shapeBorderColorInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.borderColor = shapeBorderColorInput.value
        renderCanvas()
    })
}

// Shape border width
if(shapeBorderWidthInput){
    shapeBorderWidthInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.borderWidth = parseInt(shapeBorderWidthInput.value) || el.borderWidth
        renderCanvas()
    })
}

// Text inside shapes
if(shapeTextInput){
    shapeTextInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        el.text = shapeTextInput.value
        renderCanvas()
    })
}

// Shape corner radius
if(shapeRadiusInput){
    shapeRadiusInput.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "rect") return

        el.radius = parseInt(shapeRadiusInput.value) || 0
        renderCanvas()
    })
}

// Slide title editing
if(slideTitleInput){
    slideTitleInput.addEventListener("input", () => {
        if(!activeSlide) return

        activeSlide.title = slideTitleInput.value
        renderSlides()
    })
}

// Slide notes editing
if(slideNotesInput){
    slideNotesInput.addEventListener("input", () => {
        if(!activeSlide) return

        activeSlide.notes = slideNotesInput.value
    })
}

addImageBtn.onclick = () => {

    if(!activeSlide) return

    imageFileInput.onchange = () => {
        const file = imageFileInput.files[0]
        if(!file) return

        const reader = new FileReader()

        reader.onload = (e) => {

            saveState()

            activeSlide.elements.push({
                type: "image",
                src: e.target.result,
                x: 60,
                y: 60,
                w: 180,
                h: 120,
                rotation: 0
            })

            renderCanvas()
        }

        reader.readAsDataURL(file)
    }
    imageFileInput.click()
}

if(addRectBtn){
    addRectBtn.onclick = () => {
        if(!activeSlide) return

        saveState()

        activeSlide.elements.push({
            type: "rect",
            x: 80,
            y: 80,
            w: 140,
            h: 90,
            rotation: 0,

            // shape styling
            fillColor: "#1f6feb33",
            borderColor: "#58a6ff",
            borderWidth: 1,
            radius: 0,
            text: ""
        })

        renderCanvas()
    }
}

if(addCircleBtn){
    addCircleBtn.onclick = () => {
        if(!activeSlide) return

        saveState()

        activeSlide.elements.push({
            type: "circle",
            x: 100,
            y: 100,
            w: 100,
            h: 100,
            rotation: 0,

            fillColor: "#f2c94c33",
            borderColor: "#f2c94c",
            borderWidth: 1,
            text: ""
        })

        renderCanvas()
    }
}

if(addTriangleBtn){
    addTriangleBtn.onclick = () => {
        if(!activeSlide) return

        saveState()

        activeSlide.elements.push({
            type: "triangle",
            x: 120,
            y: 120,
            w: 120,
            h: 100,
            rotation: 0,

            fillColor: "#58a6ff",
            borderColor: "#58a6ff",
            borderWidth: 1,
            text: ""
        })

        renderCanvas()
    }
}


exportBtn.onclick = () => {

    if(!slides.length){
        log("No slides to export")
        return
    }

    let html = "<html><head><meta charset='UTF-8'><title>Storyboard Export</title>"

    html += `
    <style>
    body{margin:0;background:#0f1117;color:#e6edf3;font-family:sans-serif}
    section{position:relative;width:1366px;height:664px;margin:40px auto;background:#0d1117;border:2px dashed #58a6ff}
    </style>
    </head><body>`

    slides.forEach((s, index) => {

        html += `<section id="slide-${index+1}">`

        s.elements.forEach(el => {

            if(el.type === "text")
                html += `<div style="position:absolute;left:${el.x}px;top:${el.y}px;font-family:${el.fontFamily||'Arial'};font-size:${el.fontSize||24}px;color:${el.color||'#ffffff'}">${el.content}</div>`

            if(el.type === "image")
                html += `<img src="${el.src}" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w||180}px;height:${el.h||120}px">`

            if(el.type === "rect")
                html += `<div style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w||120}px;height:${el.h||80}px;background:${el.fillColor||'#1f6feb33'};border:${el.borderWidth||1}px solid ${el.borderColor||'#58a6ff'};border-radius:${el.radius||0}px"></div>`

            if(el.type === "circle")
                html += `<div style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w||100}px;height:${el.h||100}px;background:${el.fillColor||'#f2c94c33'};border:${el.borderWidth||1}px solid ${el.borderColor||'#f2c94c'};border-radius:50%"></div>`

            if(el.type === "triangle")
                html += `<div style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w||120}px;height:${el.h||100}px;background:${el.fillColor||'#58a6ff'};clip-path:polygon(50% 0%, 0% 100%, 100% 100%)"></div>`

        })

        html += "</section>"

    })

    html += "</body></html>"

    const blob = new Blob([html], {type:"text/html"})
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "storyboard_export.html"
    a.click()

    log("Storyboard exported as HTML")
}

// --- Save/Load Project Buttons ---
const saveProjectBtn = document.getElementById('saveProjectBtn')
const loadProjectBtn = document.getElementById('loadProjectBtn')

if(saveProjectBtn){
    saveProjectBtn.onclick = exportWorkspaceZip
}

if(loadProjectBtn){
    loadProjectBtn.onclick = () => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".zip"

        input.onchange = ()=>{
            if(input.files[0]){
                importWorkspaceZip(input.files[0])
            }
        }

        input.click()
    }
}


if(!loadProject()){
    createSlide()
}

// Grid toggle
if(gridToggleBtn){
    gridToggleBtn.onclick = () => {
        gridEnabled = !gridEnabled

        if(gridEnabled){
            canvas.classList.remove('canvas-grid-off')
        }else{
            canvas.classList.add('canvas-grid-off')
        }
    }
}

// Zoom controls
function updateZoom(){
    canvas.style.transform = `scale(${zoomLevel})`
    canvas.style.transformOrigin = "top left"

    if(zoomDisplay)
        zoomDisplay.textContent = Math.round(zoomLevel * 100) + "%"
}

if(zoomInBtn){
    zoomInBtn.onclick = () => {
        zoomLevel = Math.min(zoomLevel + 0.1, 2)
        updateZoom()
    }
}

if(zoomOutBtn){
    zoomOutBtn.onclick = () => {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.5)
        updateZoom()
    }
}

// --- Layer Order Buttons ---
const bringForwardBtn = document.createElement('button')
bringForwardBtn.id = 'bringForwardBtn'
bringForwardBtn.className = 'secondary-btn'
bringForwardBtn.textContent = 'Bring Forward'

const sendBackwardBtn = document.createElement('button')
sendBackwardBtn.id = 'sendBackwardBtn'
sendBackwardBtn.className = 'secondary-btn'
sendBackwardBtn.textContent = 'Send Backward'

bringForwardBtn.onclick = () => {
    if(!activeSlide || selectedElements.length === 0) return
    const el = selectedElements[0]
    const index = activeSlide.elements.indexOf(el)
    if(index < activeSlide.elements.length - 1){
        const tmp = activeSlide.elements[index + 1]
        activeSlide.elements[index + 1] = el
        activeSlide.elements[index] = tmp
        renderCanvas()
        log("Element brought forward")
    }
}

sendBackwardBtn.onclick = () => {
    if(!activeSlide || selectedElements.length === 0) return
    const el = selectedElements[0]
    const index = activeSlide.elements.indexOf(el)
    if(index > 0){
        const tmp = activeSlide.elements[index - 1]
        activeSlide.elements[index - 1] = el
        activeSlide.elements[index] = tmp
        renderCanvas()
        log("Element sent backward")
    }
}

// (Removed slide size presets logic)

updateZoom()
// --- Text Toolbar Controls ---

if(boldBtn){
    boldBtn.onclick = () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.fontWeight = el.fontWeight === "bold" ? "normal" : "bold"
        updateInspector()
        renderCanvas()
    }
}

if(italicBtn){
    italicBtn.onclick = () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.fontStyle = el.fontStyle === "italic" ? "normal" : "italic"
        updateInspector()
        renderCanvas()
    }
}

if(underlineBtn){
    underlineBtn.onclick = () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.textDecoration = el.textDecoration === "underline" ? "none" : "underline"
        updateInspector()
        renderCanvas()
    }
}

if(alignLeftBtn){
    alignLeftBtn.onclick = () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.align = "left"
        updateInspector()
        renderCanvas()
    }
}

if(alignCenterBtn){
    alignCenterBtn.onclick = () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.align = "center"
        updateInspector()
        renderCanvas()
    }
}

if(alignRightBtn){
    alignRightBtn.onclick = () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.align = "right"
        updateInspector()
        renderCanvas()
    }
}

if(toolbarFontFamily){
    toolbarFontFamily.addEventListener("change", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.fontFamily = toolbarFontFamily.value
        renderCanvas()
    })
}

if(toolbarFontSize){
    toolbarFontSize.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.fontSize = parseInt(toolbarFontSize.value) || el.fontSize
        renderCanvas()
    })
}

if(toolbarTextColor){
    toolbarTextColor.addEventListener("input", () => {
        if(selectedElements.length === 0) return
        const el = selectedElements[0]
        if(el.type !== "text") return

        el.color = toolbarTextColor.value
        renderCanvas()
    })
}

// --- Slide Notes collapse / expand ---
const notesContainer = document.querySelector('.slide-notes')

if(notesContainer){
    const notesLabel = notesContainer.querySelector('label')
    const textarea = notesContainer.querySelector('textarea')

    if(notesLabel && textarea){
        notesLabel.style.cursor = 'pointer'
        notesLabel.textContent = "Slide Notes ▼"
        notesLabel.onclick = () => {
            if(textarea.style.display === "none"){
                textarea.style.display = "block"
                notesLabel.textContent = "Slide Notes ▼"
            }
            else{
                textarea.style.display = "none"
                notesLabel.textContent = "Slide Notes ▲"
            }
        }
    }
}

// --- PATCH: Header and Slides Panel Layout ---
// PART 1: Separate header into two rows
document.addEventListener("DOMContentLoaded", () => {
    // Find the main header container with class 'header-row'
    const headerRow = document.querySelector('.header-row')
    if(headerRow){
        // Check if not already patched (avoid double-patching)
        if(!headerRow.dataset.patched){
            headerRow.style.flexDirection = "column"
            headerRow.style.alignItems = "stretch"
            headerRow.style.gap = "8px"
            headerRow.dataset.patched = "true"

            // Hide Add Slide buttons in header
            const headerAddButtons = headerRow.querySelectorAll('#addSlideBtn, #addSlideBtn2')
            headerAddButtons.forEach(btn => {
                if(btn) btn.style.display = 'none'
            })

            // Make header fixed (reliable in Electron)
            headerRow.style.position = "fixed"
            headerRow.style.top = "0"
            headerRow.style.left = "0"
            headerRow.style.right = "0"
            headerRow.style.zIndex = "1000"
            headerRow.style.background = "#0f1117"

            // Reduced height + tighter padding
            headerRow.style.padding = "6px 10px"

            // Subtle bottom border
            headerRow.style.borderBottom = "1px solid #30363d"

            // Slight shadow for separation
            headerRow.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)"

            // Push content down so it is not hidden under header
            document.body.style.paddingTop = "80px"

            // Find .brand and .header-actions
            const brand = headerRow.querySelector('.brand')
            const headerActions = headerRow.querySelector('.header-actions')
            if(brand){
                brand.style.display = "flex"
                brand.style.alignItems = "center"
                brand.style.gap = "16px"
            }
            if(headerActions){
                headerActions.style.display = "flex"
                headerActions.style.gap = "8px"
                headerActions.style.flexWrap = "wrap"
                headerActions.style.justifyContent = "flex-end"
            }
        }
    }

    // PART 2: Make Slides panel collapsible
    // Look for <div class="slides-panel"> with a heading and replace with <details> collapsible
    const slidesPanel = document.querySelector('.slides-panel')
    if(slidesPanel && !slidesPanel.closest('.slides-group')){
        // Find the heading if present
        let heading = slidesPanel.querySelector('.panel-heading')
        let headingText = "Slides"
        if(heading){
            headingText = heading.textContent.trim()
            heading.remove()
        }
        // Create details/summary wrapper
        const details = document.createElement('details')
        details.className = "collapsible-group slides-group"
        details.open = true
        // Create summary
        const summary = document.createElement('summary')
        // Ensure collapse indicator is present
        const indicator = document.createElement('span')
        indicator.className = "collapse-indicator"
        indicator.textContent = "▾"
        summary.appendChild(indicator)
        summary.appendChild(document.createTextNode(" "))
        const strong = document.createElement('strong')
        strong.textContent = headingText
        summary.appendChild(strong)
        details.appendChild(summary)
        // Move slidesPanel into details, but keep its children intact
        slidesPanel.parentNode.insertBefore(details, slidesPanel)
        details.appendChild(slidesPanel)
    }

    // --- NEW: Create bottom action bar under canvas ---
    const canvasContainer = canvas.parentElement

    if(canvasContainer){
        const actionBar = document.createElement('div')
        actionBar.className = 'canvas-actions'
        actionBar.style.display = 'flex'
        actionBar.style.justifyContent = 'flex-end'
        actionBar.style.gap = '8px'
        actionBar.style.marginTop = '10px'
        actionBar.style.padding = '0 10px'
        actionBar.style.alignItems = 'center'

        // Clone Add Slide button for bottom bar
        const addSlideClone = addSlideBtn2.cloneNode(true)
        addSlideClone.onclick = createSlide
        addSlideClone.textContent = "Add Slide"

        const buttons = [
            addSlideClone,
            deleteSlideBtn,
            duplicateSlideBtn,
            bringForwardBtn,
            sendBackwardBtn,
            gridToggleBtn,
            zoomOutBtn,
            zoomInBtn,
            exportBtn
        ]

        buttons.forEach(btn => {
            if(btn){
                // detach from previous parent
                if(btn.parentElement && btn !== addSlideClone){
                    btn.parentElement.removeChild(btn)
                }

                // Match size of thumbnail + Slide button
                btn.style.width = '160px'
                btn.style.height = '42px'
                btn.style.flex = '0 0 auto'
                btn.style.fontSize = '12px'

                actionBar.appendChild(btn)
            }
        })

        canvasContainer.appendChild(actionBar)
    }
});
// Hook save/load to keyboard shortcuts (temporary UI)
document.addEventListener("keydown", (e)=>{
    if(e.ctrlKey && e.key.toLowerCase() === "s"){
        e.preventDefault()
        exportProject()
    }

    if(e.ctrlKey && e.key.toLowerCase() === "o"){
        e.preventDefault()

        const input = document.createElement("input")
        input.type = "file"
        input.accept = "application/json"

        input.onchange = ()=>{
            if(input.files[0]){
                importProject(input.files[0])
            }
        }

        input.click()
    }
})

window.addEventListener("beforeunload", saveProject)