/*{
                originalRoot: {
                    kind: 'Document',
                    definitions: [
                        // Provide all fragments here because if one of info.fieldNodes is a field node of a fragment,
                        // that fragment is not necessarily used anywhere via the spread operator within any of the roots
                        ...objectValues(info.fragments),
                        info.operation
                    ]
                },
                originalNode: original,
                node: root,
                schema: info.schema,
                links: config.links!,
                ignoreFirstLayer: root.kind != 'FragmentDefinition' // first-level fields would be nested calls, there we want the link data
            });*/
