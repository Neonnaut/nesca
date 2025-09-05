import type Escape_Mapper from '../escape_mapper';
import Logger from '../logger';

import { recursive_expansion } from '../utilities';
import type { Output_Mode } from '../types';

class Category_Resolver {
   private logger: Logger;
   private escape_mapper: Escape_Mapper;
   private output_mode: Output_Mode;

   private category_pending: Map<string, { content:string, line_num:number }>;

   public trans_categories: Map<string, string[]>;

   constructor(
      logger: Logger, output_mode: Output_Mode,
      escape_mapper: Escape_Mapper,
      
      category_pending: Map<string, { content:string, line_num:number }>
   ) {
      this.logger = logger; this.output_mode = output_mode;
      this.escape_mapper = escape_mapper;
      
      this.category_pending = category_pending;

      this.trans_categories = new Map;

      this.resolve_categories();
      if (this.output_mode === 'debug'){ this.show_debug(); }
   }

   private resolve_categories() {
      // Expand categories
      for (const [key, value] of this.category_pending.entries()) {
         const expanded_content = recursive_expansion(value.content, this.category_pending);
         this.category_pending.set(key, {
               content: expanded_content,
               line_num: value.line_num, // Preserve original line_num
         });
      }

      // Resolve categories
      for (const [key, value] of this.category_pending) {
         const new_category_field:string[] = value.content.split(/[,\s]+/).filter(Boolean);
         this.trans_categories.set(key, new_category_field); ////
      }
   }

   show_debug(): void {
      let categories = [];
      for (const [key, value] of this.trans_categories) {
         let cat_field:string[] = [];
         for (let i = 0; i < value.length; i++) {
               cat_field.push(`${value[i]}`);
         }
         const category_field:string = `${cat_field.join(', ')}`;

         categories.push(`  ${key} = ${category_field}`);
      }

      let info:string =
         `~ CATEGORIES ~\n` +
         `\nCategories {\n` + categories.join('\n') + `\n}`

      this.logger.diagnostic(info);
   }
}

export default Category_Resolver;