/**
 * CITS3200 - Professional Computing - Group 15:
 *  Ruan van Zyl (23784316),
 *  Hogan Tan (23644329)
 *  Ivy Qi (24270483)
 *  Suhrid Mahmood Pushan (24306853)
 *  Tasveer Mann (23585984) 
 *  Wenbo Zhong (24247407)
 *  
 * Kinematics file:
 *  File containing the functions for creating the vector between joints for use in plotting of the bones and creating the variables required for the restrictions
 */

// Imports
// Vector and matrix structures for use in runtime operations, Quaternion allows for the calculation of 3D rotations
import { Vector3, Quaternion, Matrix4 } from "three";
import type { Vec3 } from "./skeleton-data";
import type { SkeletonState } from "./skeleton-state";


// Interfaces
// BoneTransform interface for consistency of formed matrix structure
export interface BoneTransform {
    length: number;
    midpoint: Vector3;
    rotation: Quaternion;
}


function boneTransform(start: Vec3, end: Vec3): BoneTransform {
    // The function takes two Vec3 positions (structure from skeleton-data) and creates the vector that travels between the points, determines the midpoint of the vector
    // later use in rendering, the rotation of the vector from the neutral via the Quaternion function '.setFromUnitVectors' and returns the Quaternion object of the vector
    // and its rotation, returns the position vector and rotation quaternion

    // Convert the code-defined Vec3 data into Vector3
    const startVector = new Vector3(start.x, start.y, start.z);
    const endVector = new Vector3(end.x, end.y, end.z);

    // Set reference vector along the positive y (up the body) (was {0, 0, 1} in Python but is given differently for our new coordinate system in ts)
    const refVectorY = new Vector3(0, 1, 0);

    // Calculate the length and direction travelled (end - start) from start to end
    const direction = new Vector3().subVectors(endVector, startVector);
    const length = direction.length();

    // Determine whether the joints are on the same point (when direction is {0, 0, 0}) and set the unit vector accordingly at either: the unit vector for direction 
    // or reference the coordinate system reference {0, 1, 0} 
    let unitDirection = new Vector3();
    if(length > 1e-10) {
        unitDirection = direction.clone().normalize();
    } else {
        unitDirection = new Vector3(0, 1, 0);
    }

    // Calculate the midpoint
    const midpoint = new Vector3().addVectors(startVector, endVector).multiplyScalar(0.5);

    // Form the rotation quaternion
    const rotation = new Quaternion().setFromUnitVectors(refVectorY, unitDirection);

    return { length, midpoint, rotation}
}

function makeTransformMatrix(length: number, midpoint: Vector3, rotation: Quaternion): Matrix4 {
    // The function takes a provided position and rotation and generates/returns the transformation matrix
    // We need to convert the length to Vector3 form, as the scaling in Matrix requires it that way (scaling in Y axis)
    const scale = new Vector3(1, length, 1)
    const transformMatrix = new Matrix4().compose(midpoint, rotation, scale);

    return transformMatrix
}

function computeAllBoneTransformations(state: SkeletonState): Map<string, BoneTransform> {
    // The function will loop over all SkeletonState.bones (defined in skeleton-state) to find the joints the bone lies between and calculate (by calling) the boneTransform for 
    // each, returning a key mapping for the transform to the bone.name (defined in skeleton-data)
    const results = new Map<string, BoneTransform>();
    for(const bone of state.bones) {
        const transform = boneTransform(state.joints[bone.startJoint], state.joints[bone.endJoint]);

        results.set(bone.name, transform);
    }
    return results;
}