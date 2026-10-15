"""Run with Blender --background --factory-startup --python to isolate ZG's check."""
import json
import bpy

collection = bpy.data.collections.new('GEAR')
bpy.context.collection.children.link(collection)
print('ZG_COLLECTION_PROBE', json.dumps({
    'blender': bpy.app.version_string,
    'directlyLinked': collection.name in bpy.context.collection.children,
    'sceneUserOfId': bpy.context.scene.user_of_id(collection),
    'zgWouldLinkAgain': not bpy.context.scene.user_of_id(collection),
}))
