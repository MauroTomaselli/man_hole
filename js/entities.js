// entities.js

class Pedestrian {
    constructor(scene, isTopPath, startX, y, speed, material) {
        this.isTopPath = isTopPath;
        this.speed = speed;
        this.direction = isTopPath ? 1 : -1; // Top moves Right, Bottom moves Left
        this.active = true;
        this.falling = false;
        
        // Geometry for Pedestrian (a simple upright rectangle)
        const geometry = new THREE.PlaneGeometry(6, 12);
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.mesh.position.set(startX, y + 6, 0.1); // slightly above background
        scene.add(this.mesh);
        
        // State tracking for the two holes on their path
        this.passedFirstHole = false;
        this.passedSecondHole = false;
        
        // Hole X coordinates (Left = -40, Right = 40)
        this.firstHoleX = isTopPath ? -40 : 40;
        this.secondHoleX = isTopPath ? 40 : -40;
        
        this.logicalX = startX;
        this.logicalY = y + 6;
    }

    update(dt) {
        if (!this.active) return;

        if (this.falling) {
            // Fall down animation
            this.mesh.position.y -= 30 * dt;
            this.mesh.rotation.z += 5 * dt;
            this.mesh.scale.x *= 0.95;
            this.mesh.scale.y *= 0.95;
            
            if (this.mesh.scale.x < 0.1) {
                this.active = false;
                this.mesh.visible = false;
            }
            return;
        }

        // Normal movement (smooth internally)
        this.logicalX += this.speed * this.direction * dt;
        
        // Strict bit-based movement (8 units per bit)
        const stepSize = 8;
        const prevStepIndex = this.currentStepIndex;
        this.currentStepIndex = Math.round(this.logicalX / stepSize);
        
        this.mesh.position.x = this.currentStepIndex * stepSize;
        
        // Track step transitions for collision logic
        if (this.currentStepIndex !== prevStepIndex && prevStepIndex !== undefined) {
            this.justStepped = true;
            this.previousStepX = prevStepIndex * stepSize;
            if (typeof playTick === 'function') playTick();
        } else {
            this.justStepped = false;
        }
        
        // Poggiano sempre sul pavimento (no sospensione)
        this.mesh.position.y = this.logicalY;
    }
    
    fall() {
        this.falling = true;
    }

    destroy(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
    }
}

class Player {
    constructor(scene, material) {
        // Player (manhole cover + protagonist)
        const geometry = new THREE.PlaneGeometry(16, 8);
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);
        
        // Default position: Top-Left
        this.setPosition('TL');
    }

    setPosition(posStr) {
        this.currentPos = posStr;
        // TL, TR, BL, BR
        const yTop = 15;
        const yBottom = -15;
        const xLeft = -40;
        const xRight = 40;

        switch(posStr) {
            case 'TL': this.mesh.position.set(xLeft, yTop, 0.2); break;
            case 'TR': this.mesh.position.set(xRight, yTop, 0.2); break;
            case 'BL': this.mesh.position.set(xLeft, yBottom, 0.2); break;
            case 'BR': this.mesh.position.set(xRight, yBottom, 0.2); break;
        }
    }
}
