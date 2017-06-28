import { PipelineModule } from './pipeline-module';
import { ASTNode } from 'graphql';
import { renameTypes } from '../graphql/language-utils';
import { TypeRenamingTransformer } from '../graphql/type-renamer';

/**
 * Adds endpoint-specific prefixes to all type names to avoid name collisions
 */
export class TypePrefixesModule implements PipelineModule {
    constructor(private readonly prefix: string) {

    }

    getSchemaTransformer() {
        return new TypeRenamingTransformer(name => this.prefix + name);
    }

    transformNode(node: ASTNode): ASTNode {
        return renameTypes(node, name => this.removeTypePrefix(name));
    }

    private removeTypePrefix(name: string) {
        if (!name.startsWith(this.prefix)) {
            return name;
        }

        return name.substr(this.prefix.length);
    }
}
