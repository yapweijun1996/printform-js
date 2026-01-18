/* eslint-disable no-console */

export const ROW_SELECTOR = ".prowitem, .ptac-rowitem, .paddt-rowitem";

export const PTAC_MAX_WORDS_PER_SEGMENT = 200;
export const PADDT_MAX_WORDS_PER_SEGMENT = 200;

function isTextNode(node) {
  return node && node.nodeType === 3;
}

function isElementNode(node) {
  return node && node.nodeType === 1;
}

/**
 * Ensures that the 'target' node has the same ancestry chain as the 'source' node
 * up to the root, creating missing clones as needed.
 * Returns the corresponding parent in the target tree.
 */
function ensureParentStructure(chunkRoot, sourceParent, rootOriginal) {
  if (sourceParent === rootOriginal) {
    return chunkRoot;
  }
  // This is a simplified approach: we assume structure is relatively flat.
  // For deep trees, we would need to traverse up from sourceParent to rootOriginal
  // and check existence in chunkRoot.
  // Since this is for PTAC (text), we assume <p> -> [<b>, <span>, text] -> text
  // We can just clone the parent.
  
  // Find path from root to sourceParent
  const path = [];
  let curr = sourceParent;
  while (curr && curr !== rootOriginal) {
    path.unshift(curr);
    curr = curr.parentNode;
  }
  
  // Reconstruct path in chunkRoot
  let targetCurr = chunkRoot;
  path.forEach(origEl => {
    // Check if the last child of targetCurr matches origEl's tag/attrs
    // We strictly want to append to the "current open" element, which is usually the last child.
    let lastChild = targetCurr.lastElementChild;
    // We only re-use the last child if it's a clone of our current path element
    // (In a real robust solution we'd track IDs, but here we just append new structure if needed)
    
    // For simplicity in this specific "splitting" use case:
    // We always want to append to the end.
    // If the last child is "closed" (conceptually), we might need a new one.
    // But here, we are building the tree linearly.
    
    if (!lastChild || lastChild.tagName !== origEl.tagName) {
      const clone = origEl.cloneNode(false);
      targetCurr.appendChild(clone);
      targetCurr = clone;
    } else {
      // Re-use existing open tag
      targetCurr = lastChild;
    }
  });
  return targetCurr;
}

function splitParagraphIntoHtmlChunks(node, maxWords) {
  if (!node) return [];
  const text = (node.textContent || "").trim();
  if (!text) return [node.outerHTML || ""];
  
  // Quick check: if short enough, return as is (preserves everything)
  const totalWords = text.split(/\s+/).filter(w => w).length;
  if (totalWords <= maxWords) {
    return [node.outerHTML];
  }

  const chunks = [];
  let currentChunkRoot = node.cloneNode(false);
  let currentWordCount = 0;
  
  // Recursive walker
  function walk(currNode) {
    if (isTextNode(currNode)) {
      const content = currNode.textContent;
      // Split preserving whitespace logic roughly
      const words = content.split(/(\s+)/); 
      
      let buffer = "";
      
      words.forEach(part => {
        // If it's just whitespace, append and continue
        if (!part.trim()) {
          buffer += part;
          return;
        }
        
        // It's a word
        if (currentWordCount >= maxWords) {
          // Flush buffer to current chunk
          if (buffer) {
            const parentInChunk = ensureParentStructure(currentChunkRoot, currNode.parentNode, node);
            parentInChunk.appendChild(document.createTextNode(buffer));
            buffer = "";
          }
          
          // Push current chunk
          chunks.push(currentChunkRoot.outerHTML);
          
          // Start new chunk
          currentChunkRoot = node.cloneNode(false);
          currentWordCount = 0;
        }
        
        buffer += part;
        currentWordCount++;
      });
      
      // Flush remaining buffer
      if (buffer) {
        const parentInChunk = ensureParentStructure(currentChunkRoot, currNode.parentNode, node);
        parentInChunk.appendChild(document.createTextNode(buffer));
      }
      
    } else if (isElementNode(currNode)) {
      // Traverse children
      currNode.childNodes.forEach(child => walk(child));
    }
  }

  walk(node);
  
  // Push the last chunk if not empty
  if (currentChunkRoot.innerHTML.trim()) {
    chunks.push(currentChunkRoot.outerHTML);
  }
  
  return chunks;
}

function splitPaddtParagraphIntoHtmlChunks(node, maxWords) {
  return splitParagraphIntoHtmlChunks(node, maxWords);
}

export { splitParagraphIntoHtmlChunks, splitPaddtParagraphIntoHtmlChunks };
