// cards.js
class CardManager {
    constructor(board) {
        this.board = board;
        this.cardTypes = [
            TelekinesisCard,
            OnslaughtCard,
            PolymorphCard,
            DraughtCard,
            BizarreMutationCard
        ];
    }

    getAvailableCards() {
        const availableCards = [];

        this.cardTypes.forEach(CardClass => {
            // Create temporary card to check requirements
            const tempCard = new CardClass(this.board);
            if (tempCard.checkRequirements()) {
                availableCards.push(CardClass);
            }
        });

        return availableCards;
    }
}
class Card {
    constructor(name, description, board) {
        this.name = name;
        this.description = description;
        this.board = board;
        this.stages = 1;
        this.currentStage = 0;
        this.selectableTiles = new Set();        // Tiles that can be selected
        this.selectedObjects = new Map();         // Stage -> Map of selected object to target tile
        this.maxSelections = [1];                 // How many selections allowed per stage
        this.initializeStages();
    }

    // Initialize selection tracking for each stage
    initializeStages() {
        this.selectedObjects.clear();
        for (let i = 0; i < this.stages; i++) {
            this.selectedObjects.set(i, new Map());
        }
    }

    // Reset card state
    reset() {
        this.currentStage = 0;
        this.initializeStages();
        this.determineSelectables();
    }

    // Stage management
    advanceStage() {
        if (this.currentStage < this.stages - 1) {
            this.currentStage++;
            this.determineSelectables();
            return true;
        }
        return false;
    }

    isStageComplete() {
        const currentSelections = this.selectedObjects.get(this.currentStage);
        return currentSelections.size >= this.maxSelections[this.currentStage];
    }

    // Selection management
    addSelectable(target) {
        if (!target) return false;

        if (target instanceof Piece) {
            if (target.state === 'alive' && target.currentTile) {
                this.selectableTiles.add(target.currentTile);
                return true;
            }
        }
        else if (target instanceof Tile) {
            this.selectableTiles.add(target);
            return true;
        }
        return false;
    }

    toggleSelection(target) {
        // Check if this target was selected in any previous stage
        for (let stage = 0; stage < this.currentStage; stage++) {
            const stageSelections = this.selectedObjects.get(stage);
            if (Array.from(stageSelections.keys()).some(obj =>
                (obj instanceof Piece && target instanceof Piece && obj === target) ||
                (obj instanceof Tile && target instanceof Tile && obj === target))) {
                // Found in a previous stage, reset to that stage
                this.currentStage = stage;
                // Clear all selections after this stage
                for (let i = stage; i < this.stages; i++) {
                    this.selectedObjects.get(i).clear();
                }
                this.determineSelectables();
                this.board.gameState.updateTileStates();
                return false;
            }
        }

        // Handle current stage selection
        const currentSelections = this.selectedObjects.get(this.currentStage);

        // If target is a piece, we're selecting its tile
        const targetTile = (target instanceof Piece) ? target.currentTile : target;

        // If this object is already selected in current stage
        if (Array.from(currentSelections.keys()).some(obj =>
            (obj instanceof Piece && target instanceof Piece && obj === target) ||
            (obj instanceof Tile && target instanceof Tile && obj === target))) {

            // Remove selection
            for (let [key, value] of currentSelections) {
                if ((key instanceof Piece && target instanceof Piece && key === target) ||
                    (key instanceof Tile && target instanceof Tile && key === target)) {
                    currentSelections.delete(key);
                    break;
                }
            }
            this.determineSelectables();
            this.board.gameState.updateTileStates();
            return false;
        }

        // Check if target's tile is selectable and we haven't hit selection limit
        if (this.selectableTiles.has(targetTile) &&
            currentSelections.size < this.maxSelections[this.currentStage]) {

            currentSelections.set(target, targetTile);

            if (this.isStageComplete()) {
                this.advanceStage();
            } else {
                this.determineSelectables();
            }

            this.board.gameState.updateTileStates();
            return true;
        }

        return false;
    }

    // Utility methods for card creation
    getPiecesByType(pieceName, colorRequirement = 'any') {
        return this.board.pieces.filter(piece => {
            if (piece.state === 'dead') return false;
            if (piece.name !== pieceName) return false;

            switch(colorRequirement) {
                case 'own':
                    return piece.color === this.board.gameState.currentPlayer;
                case 'enemy':
                    return piece.color !== this.board.gameState.currentPlayer;
                case 'any':
                    return true;
                default:
                    return false;
            }
        });
    }

    getPiecesByTypes(pieceNames, colorRequirement = 'any') {
        return this.board.pieces.filter(piece => {
            if (piece.state === 'dead') return false;
            if (!pieceNames.includes(piece.name)) return false;

            switch(colorRequirement) {
                case 'own':
                    return piece.color === this.board.gameState.currentPlayer;
                case 'enemy':
                    return piece.color !== this.board.gameState.currentPlayer;
                case 'any':
                    return true;
                default:
                    return false;
            }
        });
    }

    // Board manipulation methods
    transformPiece(piece, newType) {
        return this.board.transformPiece(piece, newType);
    }

    movePiece(piece, targetTile) {
        if (piece && piece.state === 'alive' && targetTile) {
            piece.currentTile.clear();
            piece.spawn(targetTile);
            return true;
        }
        return false;
    }
    hasValidCardinalMoves(piece) {
        const directions = [[0,1], [0,-1], [1,0], [-1,0]];
        return directions.some(([dx,dy]) => {
            const targetX = piece.currentTile.x + dx;
            const targetY = piece.currentTile.y + dy;
            const targetTile = this.board.getTileAt(targetX, targetY);
            return targetTile && !targetTile.occupyingPiece;
        });
    }

    getValidCardinalMoves(piece) {
        const validMoves = [];
        const directions = [[0,1], [0,-1], [1,0], [-1,0]];

        directions.forEach(([dx,dy]) => {
            const targetX = piece.currentTile.x + dx;
            const targetY = piece.currentTile.y + dy;
            const targetTile = this.board.getTileAt(targetX, targetY);
            if (targetTile && !targetTile.occupyingPiece) {
                validMoves.push(targetTile);
            }
        });
        return validMoves;
    }

    // Methods to be overridden by specific cards
    determineSelectables() {
        this.selectableTiles.clear();
        // Override in subclasses
    }

    checkRequirements() {
        return false;  // Override in subclasses
    }

    execute() {
        // Override in subclasses
    }

    // Visual representation
    getState() {
        return {
            name: this.name,
            description: this.description
        };
    }

    overrideAltLogic(newAltMove, newAltCapture, pieces){
        let elements = document.querySelectorAll(pieces);

        elements.forEach(element =>{
            element.isValidAltMove=newAltMove;
            element.isValidAltCapture=newAltCapture;
        });
    }
}


class OnslaughtCard extends Card {
    constructor(board) {
        super("Onslaught",
              "Move up to three pawns one tile forward",
              board);
        this.stages = 1;
        this.maxSelections = [3];
        this.initializeStages();
    }

    determineSelectables() {
        this.selectableTiles.clear();
        const pawns = this.getPiecesByType('pawn', 'own');

        pawns.forEach(pawn => {
            const forwardY = pawn.currentTile.y + (pawn.color === 'white' ? -1 : 1);
            const forwardTile = this.board.getTileAt(pawn.currentTile.x, forwardY);

            if (forwardTile && !forwardTile.occupyingPiece) {
                this.addSelectable(pawn);
            }
        });
    }

    execute() {
        const selections = this.selectedObjects.get(0);
        selections.forEach((targetTile, pawn) => {
            const forwardY = pawn.currentTile.y + (pawn.color === 'white' ? -1 : 1);
            const forwardTile = this.board.getTileAt(pawn.currentTile.x, forwardY);
            this.movePiece(pawn, forwardTile);
        });
    }

    checkRequirements() {
        const pawns = this.getPiecesByType('pawn', 'own');
        return pawns.some(pawn => {
            const forwardY = pawn.currentTile.y + (pawn.color === 'white' ? -1 : 1);
            const forwardTile = this.board.getTileAt(pawn.currentTile.x, forwardY);
            return forwardTile && !forwardTile.occupyingPiece;
        });
    }
}

class PolymorphCard extends Card {
    constructor(board) {
        super("Polymorph",
              "Demote any bishop or rook to a knight",
              board);
        this.stages = 1;
        this.maxSelections = [1];
        this.initializeStages();
    }

    determineSelectables() {
        this.selectableTiles.clear();
        const pieces = this.getPiecesByTypes(['bishop', 'rook'], 'any');
        pieces.forEach(piece => this.addSelectable(piece));
    }

    execute() {
        const selections = this.selectedObjects.get(0);
        selections.forEach((targetTile, piece) => {
            this.transformPiece(piece, 'knight');
        });
    }

    checkRequirements() {
        const pieces = this.getPiecesByTypes(['bishop', 'rook'], 'any');
        return pieces.length > 0;
    }
}

class BizarreMutationCard extends Card {
    constructor(board) {
        super("Bizarre Mutation",
              "Promote a pawn to a jumper",
              board);
        this.stages = 1;
        this.maxSelections = [1];
        this.initializeStages();
    }

    determineSelectables() {
        this.selectableTiles.clear();
        const pawns = this.getPiecesByType('pawn', 'any');
        pawns.forEach(pawn => this.addSelectable(pawn));
    }

    execute() {
        const selections = this.selectedObjects.get(0);
        selections.forEach((targetTile, pawn) => {
            this.transformPiece(pawn, 'jumper');
        });
    }

    checkRequirements() {
        const pawns = this.getPiecesByType('pawn', 'any');
        return pawns.length > 0;
    }
}

class DraughtCard extends Card {
    constructor(board) {
        super("Draught",
              "Demote a rook, bishop or knight to a jumper",
              board);
        this.stages = 1;
        this.maxSelections = [1];
        this.initializeStages();
    }

    determineSelectables() {
        this.selectableTiles.clear();
        const pieces = this.getPiecesByTypes(['rook', 'bishop', 'knight'], 'any');
        pieces.forEach(piece => this.addSelectable(piece));
    }

    execute() {
        const selections = this.selectedObjects.get(0);
        selections.forEach((targetTile, piece) => {
            this.transformPiece(piece, 'jumper');
        });
    }

    checkRequirements() {
        const pieces = this.getPiecesByTypes(['rook', 'bishop', 'knight'], 'any');
        return pieces.length > 0;
    }
}

class TelekinesisCard extends Card {
    constructor(board) {
        super("Telekinesis",
              "Move an enemy pawn one cardinal tile",
              board);
        this.stages = 2;
        this.maxSelections = [1, 1];
        this.initializeStages();
    }

    determineSelectables() {
        this.selectableTiles.clear();

        if (this.currentStage === 0) {
            // First stage: select enemy pawn
            const pawns = this.getPiecesByType('pawn', 'enemy');
            pawns.forEach(pawn => {
                if (this.hasValidCardinalMoves(pawn)) {
                    this.addSelectable(pawn);
                }
            });
        }
        else if (this.currentStage === 1) {
            // Second stage: select destination tile
            const selectedPawn = Array.from(this.selectedObjects.get(0).keys())[0];
            const cardinalMoves = this.getValidCardinalMoves(selectedPawn);
            cardinalMoves.forEach(tile => this.addSelectable(tile));
        }
    }

    execute() {
        const pawn = Array.from(this.selectedObjects.get(0).keys())[0];
        const targetTile = Array.from(this.selectedObjects.get(1).values())[0];
        this.movePiece(pawn, targetTile);
    }

    checkRequirements() {
        const pawns = this.getPiecesByType('pawn', 'enemy');
        return pawns.some(pawn => this.hasValidCardinalMoves(pawn));
    }
}
class TopsyTurvyCard extends Card {
    constructor(board) {
        super("TopsyTurvyCard",
              "Pawn's capture and move abilities are reversed",
              board);
        this.stages = 1;
        this.maxSelections = [1, 1];
        this.initializeStages();
    }
    execute() {
        const pieces = 'Pawn'
        const newAltMove = function(targetTile, board) {
            const direction = this.color === 'white' ? -1 : 1;
            const isDiagonal = Math.abs(targetTile.x - this.currentTile.x) === 1 &&
                          targetTile.y === this.currentTile.y + direction;
            const isDiagonal2 = Math.abs(targetTile.x - this.currentTile.x) === 2 &&
                    targetTile.y === this.currentTile.y + (2*direction);
            const startRank = this.color === 'white' ? 6 : 1;
            if (isDiagonal &&
                targetTile.occupyingPiece &&
                targetTile.occupyingPiece.color !== this.color) {
                    return true;
            }
            if (isDiagonal2 &&
                targetTile.occupyingPiece &&
                targetTile.occupyingPiece.color !== this.color &&
                !this.hasMoved) {
                    return true;
            }
            return false;
        }
        const newAltCapture = function(targetTile, board) {
            const direction = this.color === 'white' ? -1 : 1;
            const startRank = this.color === 'white' ? 6 : 1;
    
            // Basic one square forward capture
            if (targetTile.x === this.currentTile.x &&
                targetTile.y === this.currentTile.y + direction &&
                targetTile.occupyingPiece) {
                    return this.createCaptureResult(true, [targetTile.occupyingPiece]);
            }
            return false;
        }
        this.overrideAltLogic(newAltMove, newAltCapture, pieces);
    }

    checkRequirements() {
        const pawns = this.getPiecesByType('pawn', 'own');
        return pawns.length > 0;
    }
}
